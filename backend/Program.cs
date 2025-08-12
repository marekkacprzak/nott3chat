using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Reflection;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;

using Azure.AI.OpenAI;
using Azure.Identity;

using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption.ConfigurationModel;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;

using NotT3ChatBackend;
using NotT3ChatBackend.Data;
using NotT3ChatBackend.DTOs;
using NotT3ChatBackend.Endpoints;
using NotT3ChatBackend.Hubs;
using NotT3ChatBackend.Models;
using NotT3ChatBackend.Services;
using NotT3ChatBackend.Utils;

using Serilog;
using Serilog.Events;

// This code is staying in one file for now as an intentional experiment for .NET 10's dotnet run app.cs feature,
// but we are aware of the importance of separating so we are currently assigning regions to be split when the time is right.

#region Main Program
namespace NotT3ChatBackend
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            await Task.Delay(0);
            var builder = WebApplication.CreateBuilder(args);

            // Add explicit environment variable configuration support
            builder.Configuration.AddEnvironmentVariables();
            builder.Configuration.AddUserSecrets(Assembly.GetExecutingAssembly());

            if (builder.Environment.IsProduction())
            {
                builder.Services.AddApplicationInsightsTelemetry();
            }
            builder.Host.UseCustomSerilog(builder.Environment);

            Console.WriteLine(builder.Configuration["ASPNETCORE_ENVIRONMENT"]);
            // Development path
            var connectionString = "Data Source=database.dat";
            if (builder.Environment.IsProduction())
            {
                // Azure File Storage path for Linux production
                var dbPath = "/mnt/azurefileshare/database.dat";
                var directory = Path.GetDirectoryName(dbPath);
                if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }
                connectionString = $"Data Source={dbPath}";
                //createa file in directory with "test" content
                File.WriteAllText(Path.Combine(directory!, "test.txt"), DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"));
            }

            builder.Services.AddDbContext<AppDbContext>(opt =>
                //  opt.UseInMemoryDatabase("DB"));
                opt.UseSqlite(connectionString));
            builder.Services.AddMemoryCache();
            builder.Services.AddAuthorization();
            builder.Services.AddEndpointsApiExplorer();
            // Add CORS services
            builder.Services.AddAllowedOriginsCors(builder.Environment, builder.Configuration);

            builder.Services.AddIdentityApiEndpoints<NotT3User>()
                .AddRoles<IdentityRole>()
                .AddEntityFrameworkStores<AppDbContext>()
                .AddDefaultTokenProviders();

            // Add JWT Bearer authentication for SignalR
            builder.Services.AddAuthentication().AddSignalRJwtBearer(builder.Configuration.GetJwtSecretKey());
            builder.Services.ConfigureApplicationCookie(builder.Environment);
            builder.Services.AddApplicationRateLimiter();

            builder.Services.ConfigureIdentityPolicy();
            builder.Services.AddSignalR();
            builder.Services.AddSingleton<IOpenAiService, ChatService>();
            builder.Services.AddScoped<StreamingService>();
            builder.Services.AddScoped<IPerplexityService, PerplexityService>();
            builder.Services.AddHttpClient<IPerplexityService, PerplexityService>();
            builder.Services.AddDataProtectionFromStorage(builder.Environment);
            var app = builder.Build();

            // Initialize database and create admin user
            app.InitializeDatabase();

            var appLogger = app.Services.GetRequiredService<ILogger<Program>>();
            appLogger.LogDebug("Configuring HTTP pipeline");

            app.AddHSTSToApp();
            app.UseRouting();
            app.UseCors("OpenCorsPolicy"); // CORS must be after UseRouting
            app.UseRateLimiter();
            app.UseAuthentication();
            // CSRF protection (double-submit cookie pattern) for cookie-authenticated unsafe requests
            app.UseCsrfProtection();
            // Log 401 responses with request auth context
            app.Add401Log();
            app.UseAuthorization();

            appLogger.LogDebug("Mapping endpoints");

            app.MapAuthorizationEndpoints();
            app.MapModelEndpoints();
            app.MapChatEndpoints();
            app.Run();
        }

        public static Tuple<string, string> GenerateSecurityStamp(string password)
        {
            int length = 32;
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            var random = new Random();
            var stamp = new string(Enumerable.Repeat(chars, length)
                .Select(s => s[random.Next(s.Length)]).ToArray());
            var hasher = new PasswordHasher<IdentityUser>();
            var hash = hasher.HashPassword(new NotT3User(), password);
            return new Tuple<string, string>(stamp, hash);
        }

        public static async Task CreateUser(string userName, string email, string password,
            UserManager<NotT3User> userManager)
        {
            var user = new NotT3User { UserName = userName, Email = email };
            var result = await userManager.CreateAsync(user, password);
            if (!result.Succeeded)
            {
                throw new Exception(
                    $"Failed to create user: {string.Join(", ", result.Errors.Select(e => e.Description))}");
            }
        }
    }
}
#endregion

#region Startup/StartupExtensions.cs
public static class Startup
{
    public static IHostBuilder UseCustomSerilog(this IHostBuilder builder, IWebHostEnvironment environment)
    {
        builder.UseSerilog((context, services, loggerConfiguration) =>
        {
            var config = loggerConfiguration
                .ReadFrom.Configuration(context.Configuration)
                .ReadFrom.Services(services)
                .Enrich.FromLogContext()
                .Enrich.WithProperty("Application", "NotT3ChatBackend")
                .Enrich.WithProperty("DeployTime", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"))
                .Enrich.WithProperty("Environment", environment.EnvironmentName);
            if (context.HostingEnvironment.IsProduction())
            {
                config.WriteTo.ApplicationInsights(
                    context.Configuration["APPLICATIONINSIGHTS:CONNECTIONSTRING"],
                    TelemetryConverter.Traces,
                    restrictedToMinimumLevel: LogEventLevel.Information // You can adjust this level
                );
            }
        });
        return builder;
    }

    public static IServiceCollection AddDataProtectionFromStorage(this IServiceCollection services,
        IWebHostEnvironment environment)
    {
        if (environment.IsProduction())
        {
            services.AddDataProtection()
                .PersistKeysToFileSystem(new DirectoryInfo("/mnt/azurefileshare/keys"))
                .SetApplicationName("NotT3Chat")
                .UseCryptographicAlgorithms(
                    new AuthenticatedEncryptorConfiguration
                    {
                        EncryptionAlgorithm = EncryptionAlgorithm.AES_256_CBC,
                        ValidationAlgorithm = ValidationAlgorithm.HMACSHA256
                    });
        }

        return services;
    }

    public static IServiceCollection ConfigureIdentityPolicy(this IServiceCollection services)
    {
        services.Configure<IdentityOptions>(options =>
        {
            // This is OSS project, feel free to update this for your own use-cases
            options.SignIn.RequireConfirmedEmail = false;
            options.User.RequireUniqueEmail = true;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequireDigit = false;
            options.Password.RequiredLength = 5;
            options.Password.RequireLowercase = false;
            options.Password.RequireUppercase = false;
        });
        return services;
    }

    public static IServiceCollection AddApplicationRateLimiter(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.AddFixedWindowLimiter("api", configure =>
            {
                configure.PermitLimit = 100;
                configure.Window = TimeSpan.FromMinutes(1);
                configure.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                configure.QueueLimit = 10;
            });

            options.AddFixedWindowLimiter("auth", configure =>
            {
                configure.PermitLimit = 10;
                configure.Window = TimeSpan.FromMinutes(1);
            });
        });
        return services;
    }

    public static IServiceCollection ConfigureApplicationCookie(this IServiceCollection services,
        IWebHostEnvironment environment)
    {
        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.HttpOnly = true;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.None; // Must be None for cross-origin requests
            options.Cookie.Name = "auth-token";
            options.ExpireTimeSpan = TimeSpan.FromHours(24);
            options.SlidingExpiration = true;
            options.LoginPath = "/login";
            options.LogoutPath = "/logout";

            if (environment.IsProduction())
            {
                options.Cookie.Domain = null; // Let Azure handle domain
            }

            options.Events = new CookieAuthenticationEvents
            {
                OnValidatePrincipal = ctx =>
                {
                    var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                    logger.LogDebug("Auth(Cookie): ValidatePrincipal for {User} Path={Path}",
                        ctx.Principal?.Identity?.Name, ctx.HttpContext.Request.Path);
                    // Ensure CSRF cookie exists for authenticated user
                    if (ctx.Principal?.Identity?.IsAuthenticated == true &&
                        !ctx.HttpContext.Request.Cookies.ContainsKey(CsrfConstants.CookieName))
                    {
                        var token = CsrfTokenGenerator.GenerateToken();
                        ctx.HttpContext.Response.Cookies.Append(CsrfConstants.CookieName, token, CsrfConstants.CookieOptions);
                        logger.LogDebug("CSRF: Token cookie issued during principal validation.");
                    }
                    return Task.CompletedTask;
                },
                OnRedirectToLogin = ctx =>
                {
                    var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                    logger.LogDebug("Auth(Cookie): RedirectToLogin. OriginalPath={Path} RedirectUri={Redirect}",
                        ctx.Request.Path, ctx.RedirectUri);
                    return Task.CompletedTask;
                },
                OnSignedIn = ctx =>
                {
                    var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                    logger.LogDebug("Auth(Cookie): SignedIn {User}", ctx.Principal?.Identity?.Name);
                    // Issue CSRF token cookie on successful sign-in if missing
                    if (!ctx.HttpContext.Request.Cookies.ContainsKey(CsrfConstants.CookieName))
                    {
                        var token = CsrfTokenGenerator.GenerateToken();
                        ctx.HttpContext.Response.Cookies.Append(CsrfConstants.CookieName, token, CsrfConstants.CookieOptions);
                        logger.LogDebug("CSRF: Token cookie issued on sign-in.");
                    }
                    return Task.CompletedTask;
                },
                OnSigningOut = ctx =>
                {
                    var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                    logger.LogDebug("Auth(Cookie): SigningOut Path={Path}", ctx.HttpContext.Request.Path);
                    return Task.CompletedTask;
                }
            };
        });

        return services;
    }

    public static IServiceCollection AddAllowedOriginsCors(this IServiceCollection services,
        IWebHostEnvironment environment, IConfiguration configuration)
    {
        services.AddCors(options =>
        {
            var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
            if (allowedOrigins == null || allowedOrigins.Length == 0)
                throw new InvalidOperationException(
                    "Cors:AllowedOrigins must be set in configuration for Cors policy.");
            options.AddPolicy("OpenCorsPolicy", policy =>
            {
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials()
                    .SetPreflightMaxAge(TimeSpan.FromSeconds(86400)); // Cache preflight for 24 hours
            });
        });
        return services;
    }

    public static byte[] GetJwtSecretKey(this IConfiguration configuration)
    {
        var jwtSecretKey = configuration["Jwt:SecretKey"] ??
                           "ThisIsAVeryLongSecretKeyForJWTTokenGeneration123456789";
        return Encoding.ASCII.GetBytes(jwtSecretKey);
    }

    public static Microsoft.AspNetCore.Authentication.AuthenticationBuilder AddSignalRJwtBearer(
        this Microsoft.AspNetCore.Authentication.AuthenticationBuilder builder,
        byte[] key)
    {
        return builder.AddJwtBearer("SignalRBearer", options =>
        {
            options.RequireHttpsMetadata = false;
            options.SaveToken = true;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };

            // Configure JWT authentication ONLY for SignalR WebSocket connections
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    // Handle SignalR endpoints (/chat and /chat/negotiate) - API uses .NET Identity cookies
                    var path = context.HttpContext.Request.Path;
                    if (path.StartsWithSegments("/chat"))
                    {
                        var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                        // Priority: Authorization header -> access_token query -> cookie
                        var authHeader = context.HttpContext.Request.Headers["Authorization"].ToString();
                        if (!string.IsNullOrEmpty(authHeader) &&
                            authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                        {
                            context.Token = authHeader.Substring("Bearer ".Length).Trim();
                            logger.LogDebug(
                                "Auth(JWT): Using Authorization header for SignalR. Path={Path} UA={UA}", path,
                                context.HttpContext.Request.Headers["User-Agent"].ToString());
                        }
                        else if (context.Request.Query.TryGetValue("access_token", out var accessToken) &&
                                 accessToken.Count > 0)
                        {
                            context.Token = accessToken.ToString();
                            logger.LogDebug(
                                "Auth(JWT): Using access_token query for SignalR. Path={Path} UA={UA}", path,
                                context.HttpContext.Request.Headers["User-Agent"].ToString());
                        }
                        else
                        {
                            // Use SignalR-specific token cookie (httpOnly, secure)
                            var signalRToken = context.HttpContext.Request.Cookies["signalr-token"];
                            if (!string.IsNullOrEmpty(signalRToken))
                            {
                                context.Token = signalRToken;
                                logger.LogDebug(
                                    "Auth(JWT): Using signalr-token cookie for SignalR. Path={Path} UA={UA}",
                                    path, context.HttpContext.Request.Headers["User-Agent"].ToString());
                            }
                            else
                            {
                                logger.LogWarning(
                                    "Auth(JWT): No token found for SignalR. Will likely 401. Path={Path} Origin={Origin} Referer={Referer}",
                                    path, context.HttpContext.Request.Headers["Origin"].ToString(),
                                    context.HttpContext.Request.Headers["Referer"].ToString());
                            }
                        }
                    }

                    return Task.CompletedTask;
                },
                OnAuthenticationFailed = ctx =>
                {
                    var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                    logger.LogError(ctx.Exception, "Auth(JWT): Authentication failed. Path={Path} UA={UA}",
                        ctx.HttpContext.Request.Path, ctx.HttpContext.Request.Headers["User-Agent"].ToString());
                    return Task.CompletedTask;
                },
                OnTokenValidated = ctx =>
                {
                    var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                    var nameId = ctx.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    logger.LogInformation("Auth(JWT): Token validated for user {UserId}. Path={Path}", nameId,
                        ctx.HttpContext.Request.Path);
                    return Task.CompletedTask;
                },
                OnChallenge = ctx =>
                {
                    var logger = ctx.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
                    logger.LogWarning("Auth(JWT): Challenge issued. Path={Path} Scheme={Scheme}",
                        ctx.Request.Path, ctx.Scheme);
                    return Task.CompletedTask;
                }
            };
        });
    }


    public static void InitializeDatabase(this WebApplication app)
    {
        using (var scope = app.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<NotT3User>>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            context.Database.EnsureCreated();
#if DEBUG
            logger.LogDebug("Creating debug admin user");
            var adminUser = new NotT3User { UserName = "admin@example.com", Email = "admin@example.com" };
            var result = userManager.CreateAsync(adminUser, "admin").Result;
            if (result.Succeeded)
                logger.LogDebug("Admin user created successfully");
            else
                logger.LogWarning("Failed to create admin user: {Errors}",
                    string.Join(", ", result.Errors.Select(e => e.Description)));
#endif
        }
    }

    public static void AddHSTSToApp(this WebApplication app)
    {
        // Add CORS logging middleware
        app.Use(async (context, next) =>
        {
            var corsLogger = context.RequestServices.GetRequiredService<ILogger<CorsLoggingMiddleware>>();
            var origin = context.Request.Headers.Origin.FirstOrDefault();
            if (!string.IsNullOrEmpty(origin))
            {
                corsLogger.LogDebug("CORS request from origin: {Origin}", origin);
            }

            await next();
        });

        app.Use(async (context, next) =>
        {
            context.Response.Headers.Append("X-Frame-Options", "DENY");
            context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
            context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
            context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
            context.Response.Headers.Append("Content-Security-Policy",
                "default-src 'self'; frame-ancestors 'none'; object-src 'none';");

            // Don't add HSTS - Azure App Service handles this
            await next();
        });
    }

    public static void Add401Log(this WebApplication app)
    {
        // Log 401 responses with request auth context
        app.Use(async (context, next) =>
        {
            await next();
            if (context.Response.StatusCode == 401)
            {
                var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
                var hasAuthHeader = context.Request.Headers.ContainsKey("Authorization");
                var authHeaderLen = hasAuthHeader ? context.Request.Headers["Authorization"].ToString().Length : 0;
                var hasCookieAuth = context.Request.Cookies.ContainsKey("auth-token");
                var hasSignalRToken = context.Request.Cookies.ContainsKey("signalr-token");
                logger.LogWarning(
                    "Auth(401): Path={Path} Method={Method} HasAuthHeader={HasAuthHeader} AuthHeaderLen={Len} HasAuthCookie={HasCookie} HasSignalRCookie={HasSignalR} Origin={Origin} Referer={Referer}",
                    context.Request.Path,
                    context.Request.Method,
                    hasAuthHeader,
                    authHeaderLen,
                    hasCookieAuth,
                    hasSignalRToken,
                    context.Request.Headers["Origin"].ToString(),
                    context.Request.Headers["Referer"].ToString());
            }
        });
    }
}

public class CorsLoggingMiddleware
{
    // Marker class for logging
}

// ================= CSRF PROTECTION =================
public static class CsrfConstants
{
    public const string CookieName = "XSRF-TOKEN"; // Non-HttpOnly cookie (double submit pattern)
    public const string HeaderName = "X-CSRF-TOKEN"; // Header client must send matching cookie value
    public static readonly CookieOptions CookieOptions = new CookieOptions
    {
        HttpOnly = false, // must be readable by JS to copy into header
        Secure = true,
        SameSite = SameSiteMode.None,
        Path = "/",
        IsEssential = true
    };
    public static readonly string[] UnsafeMethods = ["POST", "PUT", "PATCH", "DELETE"];
}

public static class CsrfTokenGenerator
{
    public static string GenerateToken()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes);
    }
}

// Issues CSRF cookie for authenticated cookie-based sessions if missing
public class CsrfIssueCookieMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CsrfIssueCookieMiddleware> _logger;
    public CsrfIssueCookieMiddleware(RequestDelegate next, ILogger<CsrfIssueCookieMiddleware> logger)
    { _next = next; _logger = logger; }
    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated == true &&
            !context.Request.Cookies.ContainsKey(CsrfConstants.CookieName) &&
            IsCookieAuth(context))
        {
            var token = CsrfTokenGenerator.GenerateToken();
            context.Response.Cookies.Append(CsrfConstants.CookieName, token, CsrfConstants.CookieOptions);
            _logger.LogDebug("CSRF: Issued token cookie via middleware.");
        }
        await _next(context);
    }
    private static bool IsCookieAuth(HttpContext ctx) => ctx.Request.Cookies.ContainsKey("auth-token") &&
        !ctx.Request.Headers.ContainsKey("Authorization");
}

// Validates CSRF for unsafe methods on authenticated cookie-based requests
public class CsrfValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CsrfValidationMiddleware> _logger;
    private static readonly HashSet<string> _unsafe = new HashSet<string>(CsrfConstants.UnsafeMethods, StringComparer.OrdinalIgnoreCase);
    private static readonly string[] _preAuthAllowPaths = ["/login", "/register-user"]; // allow unauthenticated login/register
    public CsrfValidationMiddleware(RequestDelegate next, ILogger<CsrfValidationMiddleware> logger)
    { _next = next; _logger = logger; }
    public async Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;
        if (_unsafe.Contains(method))
        {
            var path = context.Request.Path.Value ?? string.Empty;
            var isAuthenticated = context.User?.Identity?.IsAuthenticated == true;
            if (isAuthenticated && IsCookieAuth(context))
            {
                var headerToken = context.Request.Headers[CsrfConstants.HeaderName].ToString();
                var cookieToken = context.Request.Cookies[CsrfConstants.CookieName];
                if (string.IsNullOrEmpty(headerToken) || string.IsNullOrEmpty(cookieToken) || !FixedTimeEquals(headerToken, cookieToken))
                {
                    _logger.LogWarning("CSRF: Validation failed. Path={Path} Method={Method} HeaderPresent={Header} CookiePresent={Cookie}", path, method, !string.IsNullOrEmpty(headerToken), !string.IsNullOrEmpty(cookieToken));
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(new { error = "CSRF validation failed" });
                    return;
                }
            }
            else if (!isAuthenticated && _preAuthAllowPaths.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
            {
                // allow login/register without CSRF (cannot issue token yet)
            }
            else if (!isAuthenticated)
            {
                // Unauthenticated unsafe method - let auth/authorization handle (likely 401)
            }
        }
        await _next(context);
    }
    private static bool IsCookieAuth(HttpContext ctx) => ctx.Request.Cookies.ContainsKey("auth-token") &&
        !ctx.Request.Headers.ContainsKey("Authorization");
    private static bool FixedTimeEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var result = 0;
        for (int i = 0; i < a.Length; i++) result |= a[i] ^ b[i];
        return result == 0;
    }
}

public static class CsrfApplicationBuilderExtensions
{
    public static IApplicationBuilder UseCsrfProtection(this IApplicationBuilder app)
    {
        return app
            .UseMiddleware<CsrfIssueCookieMiddleware>()
            .UseMiddleware<CsrfValidationMiddleware>();
    }
}

#endregion

namespace NotT3ChatBackend.Endpoints
{
    #region Endpoints/MapAuthorizationEndpoints.cs

    public class AuthorizationEndpointsMarker;
    public static class AuthorizationEndpoints
    {
        public static void MapAuthorizationEndpoints(this IEndpointRouteBuilder app)
        {
            app.MapGet("/health", (ILogger<Program> logger) =>
            {
                var testFileContent = DateTime.UtcNow.ToString("o");
                if (false && Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production")
                {
                    var dbPath = "/mnt/azurefileshare/database.dat";
                    var directory = Path.GetDirectoryName(dbPath);
                    testFileContent = File.ReadAllText(Path.Combine(directory!, "test.txt"));
                }

                logger.LogDebug("Health check requested");
                return TypedResults.Ok(testFileContent);
            }).RequireRateLimiting("api");

            app.MapIdentityApi<NotT3User>();
            app.MapPost("/logout", async (SignInManager<NotT3User> signInManager, HttpContext context) =>
            {
                await signInManager.SignOutAsync();

                // Clear the httpOnly cookies
                context.Response.Cookies.Delete("auth-token", new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.None
                });

                context.Response.Cookies.Delete("signalr-token", new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.None,
                    Path = "/chat"
                });

                // Clear CSRF token cookie (non-HttpOnly)
                context.Response.Cookies.Delete(CsrfConstants.CookieName, new CookieOptions
                {
                    HttpOnly = false,
                    Secure = true,
                    SameSite = SameSiteMode.None,
                    Path = "/"
                });

                return TypedResults.Ok();
            }).RequireAuthorization().RequireRateLimiting("auth");

            // Secure SignalR token endpoint - generates JWT for chat connections
            app.MapPost("/signalr-token",
                async (UserManager<NotT3User> userManager, HttpContext context, IConfiguration configuration) =>
                {
                    var user = await userManager.GetUserAsync(context.User);
                    if (user == null)
                    {
                        return Results.Unauthorized();
                    }

                    // Generate JWT token specifically for SignalR with longer expiration
                    var key = configuration.GetJwtSecretKey();
                    var tokenHandler = new JwtSecurityTokenHandler();
                    var tokenDescriptor = new SecurityTokenDescriptor
                    {
                        Subject = new ClaimsIdentity(new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, user.Id),
                            new Claim(ClaimTypes.Name, user.UserName ?? user.Email ?? ""),
                            new Claim(ClaimTypes.Email, user.Email ?? ""),
                            new Claim("purpose", "signalr") // Mark as SignalR-specific token
                        }),
                        Expires = DateTime.UtcNow.AddDays(1), // Longer-lived for persistent connections
                        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key),
                            SecurityAlgorithms.HmacSha256Signature)
                    };

                    var token = tokenHandler.CreateToken(tokenDescriptor);
                    var tokenString = tokenHandler.WriteToken(token);

                    // Set secure httpOnly cookie for SignalR token
                    context.Response.Cookies.Append("signalr-token", tokenString, new CookieOptions
                    {
                        HttpOnly = true,
                        Secure = true,
                        SameSite = SameSiteMode.None, // Must be None for cross-origin
                        Expires = DateTimeOffset.UtcNow.AddDays(1),
                        Path = "/chat" // Restrict to SignalR endpoints only
                    });

                    return Results.Ok(new
                    { success = true, accessToken = tokenString, tokenType = "Bearer", expiresIn = 86400 });
                }).RequireAuthorization().RequireRateLimiting("api");

            // CSRF token retrieval endpoint for cross-site SPAs
            app.MapGet("/csrf-token", (HttpContext ctx) =>
            {
                // Only for cookie-authenticated flows (no Authorization header)
                var isCookieAuth = ctx.User?.Identity?.IsAuthenticated == true
                                   && ctx.Request.Cookies.ContainsKey("auth-token")
                                   && !ctx.Request.Headers.ContainsKey("Authorization");

                if (!isCookieAuth)
                    return Results.Unauthorized();

                var token = ctx.Request.Cookies[CsrfConstants.CookieName];
                if (string.IsNullOrEmpty(token))
                {
                    token = CsrfTokenGenerator.GenerateToken();
                    ctx.Response.Cookies.Append(CsrfConstants.CookieName, token, CsrfConstants.CookieOptions);
                }

                return Results.Ok(new { token });
            }).RequireAuthorization();
        }
    }

    #endregion

    #region Endpoints/ChatEndpoints.cs
    public class ChatEndpointsMarker;
    public static class ChatEndpoints
    {
        public static void MapChatEndpoints(this IEndpointRouteBuilder app)
        {
            app.MapHub<ChatHub>("/chat")
                .RequireAuthorization(policy =>
                {
                    policy.RequireAuthenticatedUser();
                    policy.AuthenticationSchemes.Add("SignalRBearer"); // SignalR uses JWT from signalr-token cookie
                });
            app.MapPost("/chats/new", NewChat).RequireAuthorization(policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AuthenticationSchemes.Add(IdentityConstants.ApplicationScheme);
                policy.AuthenticationSchemes.Add(IdentityConstants.BearerScheme);
            });
            app.MapPost("/chats/fork", ForkChat).RequireAuthorization(policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AuthenticationSchemes.Add(IdentityConstants.ApplicationScheme);
                policy.AuthenticationSchemes.Add(IdentityConstants.BearerScheme);
            });
            app.MapDelete("/chats/{conversationId}", DeleteChat).RequireAuthorization(policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AuthenticationSchemes.Add(IdentityConstants.ApplicationScheme);
                policy.AuthenticationSchemes.Add(IdentityConstants.BearerScheme);
            });
            app.MapGet("/chats", GetChats).RequireAuthorization(policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AuthenticationSchemes.Add(IdentityConstants.ApplicationScheme);
                policy.AuthenticationSchemes.Add(IdentityConstants.BearerScheme);
            });
            app.MapPost("/register-user", RegisterUser);
        }

        public static async Task<NoContent> DeleteChat(string conversationId, AppDbContext dbContext, HttpContext context, UserManager<NotT3User> userManager, ILogger<ChatEndpointsMarker> logger, IHubContext<ChatHub> hubContext)
        {
            logger.LogDebug("Deleting conversation {ConversationId} for user", conversationId);
            try
            {
                var user = await userManager.GetUserAsync(context.User) ?? throw new UnauthorizedAccessException();
                var convo = await dbContext.GetConversationAsync(conversationId, user);
                dbContext.Conversations.Remove(convo);
                await dbContext.SaveChangesAsync();

                await hubContext.Clients.Group(user.Id).SendAsync("DeleteConversation", convo.Id);
                logger.LogDebug("Conversation {ConversationId} deleted successfully", conversationId);
                return TypedResults.NoContent();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error deleting conversation {ConversationId}", conversationId);
                throw;
            }
        }

        public static async Task<Ok<NotT3ConversationDTO>> ForkChat([FromBody] ForkChatRequestDTO request, AppDbContext dbContext, HttpContext context, UserManager<NotT3User> userManager, ILogger<ChatEndpointsMarker> logger, IHubContext<ChatHub> hubContext)
        {
            logger.LogDebug("Forking conversation {ConversationId} from message {MessageId} for user", request.ConversationId, request.MessageId);

            try
            {
                // Retrieve our conversation & messages
                var user = await userManager.GetUserAsync(context.User) ?? throw new UnauthorizedAccessException();
                var convo = await dbContext.GetConversationAsync(request.ConversationId, user);
                await dbContext.Entry(convo).Collection(c => c.Messages).LoadAsync();

                // Sort the messages by index, and find the message to fork from
                var messages = convo.Messages.OrderBy(m => m.Index).ToList();
                var forkIndex = messages.FindIndex(m => m.Id == request.MessageId);
                if (forkIndex == -1)
                {
                    logger.LogWarning("Message {MessageId} not found in conversation {ConversationId}", request.MessageId, request.ConversationId);
                    throw new KeyNotFoundException($"Message {request.MessageId} not found in conversation {request.ConversationId}");
                }

                // Create a new conversation with the forked messages
                logger.LogDebug("Forking conversation at index {ForkIndex} with {MessageCount} messages", forkIndex, messages.Count);
                var newConvo = await dbContext.CreateConversationAsync(user);
                // Copy the title from the original conversation - append (Fork), (Fork_2), ...
                newConvo.Title = convo.Title.Contains("(Branch")
                                        ? Regex.Replace(convo.Title, @"\(Branch(_\d+)?\)", m => $"(Branch_{(m.Groups[1].Success ? int.Parse(m.Groups[1].Value[1..]) + 1 : 2)})")
                                        : $"{convo.Title} (Branch)";

                // Fork the messages
                var forkedMessages = messages.Take(forkIndex + 1).Select(m => new NotT3Message()
                {
                    Index = m.Index,
                    Role = m.Role,
                    Content = m.Content,
                    Timestamp = m.Timestamp,
                    ChatModel = m.ChatModel,
                    FinishError = m.FinishError,
                    ConversationId = newConvo.Id,
                    UserId = user.Id,
                }).ToList();
                await dbContext.AddRangeAsync(forkedMessages);
                await dbContext.SaveChangesAsync();

                _ = hubContext.Clients.Group(user.Id).SendAsync("NewConversation", new NotT3ConversationDTO(newConvo));
                logger.LogDebug("New conversation created with ID: {ConversationId}", convo.Id);
                return TypedResults.Ok(new NotT3ConversationDTO(newConvo));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error creating new conversation");
                throw;
            }
        }

        public static async Task<Ok<List<NotT3ConversationDTO>>> GetChats(AppDbContext dbContext, HttpContext context, UserManager<NotT3User> userManager, ILogger<ChatEndpointsMarker> logger)
        {
            logger.LogDebug("Retrieving conversations for user");
            try
            {
                var user = await userManager.GetUserAsync(context.User) ?? throw new UnauthorizedAccessException();
                await dbContext.Entry(user).Collection(u => u.Conversations).LoadAsync();
                var conversations = user.Conversations.OrderByDescending(c => c.CreatedAt)
                                                      .Select(c => new NotT3ConversationDTO(c)).ToList();
                logger.LogDebug("Retrieved {Count} conversations for user", conversations.Count);
                return TypedResults.Ok(conversations);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving conversations");
                throw;
            }
        }

        public static async Task<Ok<NotT3ConversationDTO>> NewChat(AppDbContext dbContext, HttpContext context, UserManager<NotT3User> userManager, ILogger<ChatEndpointsMarker> logger, IHubContext<ChatHub> hubContext)
        {
            logger.LogDebug("Creating new conversation for user");
            try
            {
                var user = await userManager.GetUserAsync(context.User) ?? throw new UnauthorizedAccessException();
                var convo = await dbContext.CreateConversationAsync(user);

                _ = hubContext.Clients.Group(user.Id).SendAsync("NewConversation", new NotT3ConversationDTO(convo));
                logger.LogDebug("New conversation created with ID: {ConversationId}", convo.Id);
                return TypedResults.Ok(new NotT3ConversationDTO(convo));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error creating new conversation");
                throw;
            }
        }

        public static async Task<Ok> RegisterUser([FromBody] RegisterUserRequestDto request, UserManager<NotT3User> userManager, ILogger<ChatEndpointsMarker> logger)
        {
            logger.LogDebug("Registering new user with username: {Username} and email: {Email}", request.Username, request.UserEmail);
            try
            {
                await Program.CreateUser(request.Username, request.UserEmail, request.Password, userManager);
                logger.LogDebug("User {Username} registered successfully", request.Username);
                return TypedResults.Ok();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error registering user {Username}", request.Username);
                throw;
            }
        }
    }
    #endregion

    #region Endpoints/ModelEndpoints.cs

    public class ModelEndpointsMarker;
    public static class ModelEndpoints
    {
        public static void MapModelEndpoints(this IEndpointRouteBuilder app)
        {
            app.MapGet("/models", GetAvailableModels);
        }

        public static Ok<ICollection<ChatModelDto>> GetAvailableModels(IOpenAiService openAiService, ILogger<ModelEndpointsMarker> logger)
        {
            var models = openAiService.GetAvailableModels();
            logger.LogDebug("Retrieved {Count} available models", models.Count);
            return TypedResults.Ok(models);
        }
    }
    #endregion
}

namespace NotT3ChatBackend.Services
{
    #region Services/IOpenAIService.cs
    public interface IOpenAiService
    {
        ICollection<ChatModelDto> GetAvailableModels();
        Task InitiateConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete);
        Task InitiateTitleAssignment(string initialMessage, Func<string, ValueTask> onComplete);
    }
    #endregion

    #region Services/ChatService.cs
    public class ChatService : IOpenAiService
    {
        private readonly ILogger<ChatService> _logger;
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;
        private readonly string[] _models;
        private readonly string? _titleModel;
        private readonly bool _useOpenAi;
        private readonly AzureOpenAIClient? _azureClient;
        private readonly IPerplexityService _perplexityService;

        public ChatService(ILogger<ChatService> logger, IConfiguration configuration, IPerplexityService perplexityService)
        {
            _logger = logger;
            _configuration = configuration;
            _httpClient = new HttpClient();
            _perplexityService = perplexityService;

            // Check OpenAI configuration first (preferred)
            var openAiApiKey = configuration["OpenAI:ApiKey"];
            if (!string.IsNullOrEmpty(openAiApiKey))
            {
                _useOpenAi = true;
                _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", openAiApiKey);
                var modelsConfig = configuration.GetSection("OpenAI:Models").Get<string[]>();
                _models = modelsConfig ?? ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
                _titleModel = configuration["OpenAI:TitleModel"] ?? "gpt-4o-mini";
                _logger.LogDebug("ChatService initialized with OpenAI API using {ModelCount} models", _models.Length);
            }
            else
            {
                // Fallback to Azure OpenAI
                _useOpenAi = false;
                var azureEndpoint = configuration["AzureOpenAI:Endpoint"];
                if (string.IsNullOrEmpty(azureEndpoint))
                {
                    throw new InvalidOperationException("Either OpenAI:ApiKey or AzureOpenAI:Endpoint configuration is required");
                }

                var credential = new DefaultAzureCredential();
                _azureClient = new AzureOpenAIClient(new Uri(azureEndpoint), credential);

                var modelsConfig = configuration.GetSection("AzureOpenAI:Models").Get<string[]>();
                _models = modelsConfig ?? ["gpt-4o-mini", "gpt-4o", "gpt-35-turbo"];
                _titleModel = configuration["AzureOpenAI:TitleModel"] ?? "gpt-4o-mini";
                _logger.LogDebug("ChatService initialized with Azure OpenAI using {ModelCount} models", _models.Length);
            }
        }

        public ICollection<ChatModelDto> GetAvailableModels()
        {
            var provider = _useOpenAi ? "OpenAI" : "Azure OpenAI";
            return _models.Select(m => new ChatModelDto(m, provider)).ToList();
        }

        public async Task InitiateConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete)
        {
            _logger.LogDebug("Initiating conversation with model: {Model}, message count: {MessageCount}, provider: {Provider}",
                model, messages.Count, _useOpenAi ? "OpenAI" : "Azure OpenAI");

            try
            {
                // Handle Perplexity model differently
                if (model.Equals("perplexity", StringComparison.OrdinalIgnoreCase))
                {
                    await InitiatePerplexityStreamConversationAsync(model, messages, onContentReceived, onComplete);
                }
                else if (_useOpenAi)
                {
                    await InitiateOpenAIConversationAsync(model, messages, onContentReceived, onComplete);
                }
                else
                {
                    await InitiateAzureConversationAsync(model, messages, onContentReceived, onComplete);
                }
            }
            catch (Exception ex)
            {
                await onComplete(ex);
                _logger.LogError(ex, "Error during conversation streaming");
                throw;
            }
        }

        private async Task InitiateOpenAIConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete)
        {
            var requestBody = new
            {
                model = model,
                messages = messages.Select(m => new { role = m.Role, content = m.Content }).ToArray(),
                stream = true
            };

            var json = System.Text.Json.JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
            {
                Content = content
            };

            var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            var stream = await response.Content.ReadAsStreamAsync();
            using var reader = new StreamReader(stream);

            var contentBuilder = new StringBuilder();

            while (await reader.ReadLineAsync() is { } line)
            {
                if (line.StartsWith("data: "))
                {
                    var data = line.Substring(6);
                    if (data == "[DONE]")
                    {
                        break;
                    }

                    try
                    {
                        using var jsonDoc = System.Text.Json.JsonDocument.Parse(data);
                        var choices = jsonDoc.RootElement.GetProperty("choices");
                        if (choices.GetArrayLength() > 0)
                        {
                            var delta = choices[0].GetProperty("delta");
                            if (delta.TryGetProperty("content", out var contentElement))
                            {
                                var contentText = contentElement.GetString();
                                if (!string.IsNullOrEmpty(contentText))
                                {
                                    contentBuilder.Append(contentText);
                                    await onContentReceived(contentText);
                                }
                            }
                        }
                    }
                    catch (System.Text.Json.JsonException)
                    {
                        // Skip malformed JSON lines
                        continue;
                    }
                }
            }

            await onComplete(null);
            _logger.LogDebug("OpenAI conversation streaming completed");
        }

        private async Task InitiatePerplexityConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete)
        {
            try
            {
                _logger.LogDebug("Starting Perplexity conversation");

                // Get the last message as the search query
                var lastMessage = messages.LastOrDefault();
                if (lastMessage == null || string.IsNullOrEmpty(lastMessage.Content))
                {
                    await onComplete(new ArgumentException("No valid query provided"));
                    return;
                }

                var searchQuery = lastMessage.Content;

                // Create Perplexity search request
                var searchRequest = new PerplexitySearchRequest
                {
                    Query = searchQuery,
                    SearchRecencyFilter = "month",
                    SearchMode = "comprehensive",
                    ShowThinking = false
                };

                // Call Perplexity service
                var searchResult = await _perplexityService.SearchAsync(searchRequest);

                if (!string.IsNullOrEmpty(searchResult.Result))
                {
                    // Stream the content back
                    await onContentReceived(searchResult.Result);

                    // Add sources if available
                    if (searchResult.Sources != null && searchResult.Sources.Any())
                    {
                        var sourcesText = "\n\n**Sources:**\n" + string.Join("\n", searchResult.Sources.Select((s, i) => $"{i + 1}. {s}"));
                        await onContentReceived(sourcesText);
                    }
                }
                else
                {
                    var errorMessage = "Perplexity search failed: No results returned";
                    await onContentReceived(errorMessage);
                }

                await onComplete(null);
                _logger.LogDebug("Perplexity conversation completed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during Perplexity conversation");
                await onComplete(ex);
            }
        }

        private async Task InitiatePerplexityStreamConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete)
        {
            // Always use sonar-reasoning model for Perplexity API regardless of input model name
            var requestBody = new
            {
                model = "sonar-reasoning",
                messages = messages.Select(m => new { role = m.Role.ToLower(), content = m.Content }).ToArray(),
                stream = true
            };

            var options = new System.Text.Json.JsonSerializerOptions
            {
                PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower
            };
            var json = System.Text.Json.JsonSerializer.Serialize(requestBody, options);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.perplexity.ai/chat/completions")
            {
                Content = content
            };
            var apiKey = _configuration["Perplexity:ApiKey"];
            if (string.IsNullOrEmpty(apiKey))
            {
                _logger.LogWarning("Perplexity API key not found. Returning a mock response.");
                await onContentReceived("Perplexity API key is not configured. Please add it to your settings to use this model.");
                await onComplete(null);
                return;
            }
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

            try
            {
                var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();

                using var stream = await response.Content.ReadAsStreamAsync();
                using var reader = new StreamReader(stream);

                while (!reader.EndOfStream)
                {
                    var line = await reader.ReadLineAsync();
                    if (string.IsNullOrWhiteSpace(line)) continue;

                    if (line.StartsWith("data: "))
                    {
                        var data = line.Substring(6);
                        if (data == "[DONE]")
                        {
                            break;
                        }

                        try
                        {
                            using var jsonDoc = System.Text.Json.JsonDocument.Parse(data);
                            var choices = jsonDoc.RootElement.GetProperty("choices");
                            if (choices.GetArrayLength() > 0)
                            {
                                var delta = choices[0].GetProperty("delta");
                                if (delta.TryGetProperty("content", out var contentElement))
                                {
                                    var contentText = contentElement.GetString();
                                    if (!string.IsNullOrEmpty(contentText))
                                    {
                                        await onContentReceived(contentText);
                                    }
                                }
                            }
                        }
                        catch (System.Text.Json.JsonException ex)
                        {
                            _logger.LogWarning(ex, "Failed to parse Perplexity stream data: {Data}", data);
                        }
                    }
                }
                await onComplete(null);
                _logger.LogDebug("Perplexity conversation streaming completed.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during Perplexity conversation streaming.");
                await onComplete(ex);
            }
        }

        private async Task InitiateAzureConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete)
        {
            if (_azureClient == null)
            {
                throw new InvalidOperationException("Azure OpenAI client is not initialized");
            }

            var chatClient = _azureClient.GetChatClient(model);
            var chatMessages = messages.Select(m => CreateAzureChatMessage(m.Role, m.Content)).ToList();

            var response = chatClient.CompleteChatStreamingAsync(chatMessages);
            var contentBuilder = new StringBuilder();

            await foreach (var update in response)
            {
                if (update.ContentUpdate.Count > 0)
                {
                    var content = string.Join("", update.ContentUpdate.Select(c => c.Text ?? ""));
                    if (!string.IsNullOrEmpty(content))
                    {
                        contentBuilder.Append(content);
                        await onContentReceived(content);
                    }
                }
            }

            await onComplete(null);
            _logger.LogDebug("Azure OpenAI conversation streaming completed");
        }

        public async Task InitiateTitleAssignment(string initialMessage, Func<string, ValueTask> onComplete)
        {
            if (_titleModel is null)
            {
                _logger.LogWarning("Title model is not configured, skipping title assignment");
                return;
            }

            _logger.LogDebug("Initiating title assignment with model: {Model}, provider: {Provider}",
                _titleModel, _useOpenAi ? "OpenAI" : "Azure OpenAI");

            try
            {
                if (_useOpenAi)
                {
                    await InitiateOpenAiTitleAssignmentAsync(initialMessage, onComplete);
                }
                else
                {
                    await InitiateAzureTitleAssignmentAsync(initialMessage, onComplete);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during title assignment");
            }
        }

        private async Task InitiateOpenAiTitleAssignmentAsync(string initialMessage, Func<string, ValueTask> onComplete)
        {
            var requestBody = new
            {
                model = _titleModel,
                messages = new[] {
                    new { role = "system", content = "You are an expert chat title generator. Your task is to analyze a user's initial chat message (or the first 500 characters if it's very long) and provide a concise, descriptive, and engaging title for that chat. The title should clearly reflect the primary topic or purpose of the conversation. Output only the title, no more than 6 words. Do not treat the message as information about this - e.g., if the user write 'Test', he isn't testing the title generator." },
                    new { role = "user", content = initialMessage[..Math.Min(500, initialMessage.Length)] }
                },
                max_tokens = 20
            };

            var json = System.Text.Json.JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("https://api.openai.com/v1/chat/completions", content);
            response.EnsureSuccessStatusCode();

            var responseJson = await response.Content.ReadAsStringAsync();
            using var jsonDoc = System.Text.Json.JsonDocument.Parse(responseJson);
            var choices = jsonDoc.RootElement.GetProperty("choices");
            if (choices.GetArrayLength() > 0)
            {
                var title = choices[0].GetProperty("message").GetProperty("content").GetString() ?? "New Chat";
                _logger.LogDebug("OpenAI title assignment completed: {Title}", title);
                await onComplete(title);
            }
        }

        private async Task InitiateAzureTitleAssignmentAsync(string initialMessage, Func<string, ValueTask> onComplete)
        {
            if (_azureClient == null)
            {
                throw new InvalidOperationException("Azure OpenAI client is not initialized");
            }

            var chatClient = _azureClient.GetChatClient(_titleModel!);
            var messages = new List<OpenAI.Chat.ChatMessage>
            {
                OpenAI.Chat.ChatMessage.CreateSystemMessage("You are an expert chat title generator. Your task is to analyze a user's initial chat message (or the first 500 characters if it's very long) and provide a concise, descriptive, and engaging title for that chat. The title should clearly reflect the primary topic or purpose of the conversation. Output only the title, no more than 6 words. Do not treat the message as information about this - e.g., if the user write 'Test', he isn't testing the title generator."),
                OpenAI.Chat.ChatMessage.CreateUserMessage(initialMessage[..Math.Min(500, initialMessage.Length)])
            };

            var response = await chatClient.CompleteChatAsync(messages);
            var title = response.Value.Content[0].Text;
            _logger.LogDebug("Azure title assignment completed: {Title}", title);

            await onComplete(title);
        }

        private static OpenAI.Chat.ChatMessage CreateAzureChatMessage(string role, string content)
        {
            return role.ToLower() switch
            {
                "user" => OpenAI.Chat.ChatMessage.CreateUserMessage(content),
                "assistant" => OpenAI.Chat.ChatMessage.CreateAssistantMessage(content),
                "system" => OpenAI.Chat.ChatMessage.CreateSystemMessage(content),
                _ => throw new ArgumentException($"Unknown role: {role}", nameof(role))
            };
        }
    }
    #endregion

    #region Services/StreamingService.cs
    public class StreamingService
    {
        private readonly IOpenAiService _openAiService;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<StreamingService> _logger;
        public StreamingService(IOpenAiService openAiService, IServiceScopeFactory scopeFactory, IMemoryCache memoryCache, ILogger<StreamingService> logger)
        {
            _openAiService = openAiService;
            _scopeFactory = scopeFactory;
            _memoryCache = memoryCache;
            _logger = logger;
        }
        internal async Task StartStreaming(string model, ICollection<NotT3Message> messages, string convoId, NotT3Message assistantMsg, StreamingMessage streamingMessage, NotT3User user)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub>>();
            var convo = await dbContext.GetConversationAsync(convoId, user);

            await _openAiService.InitiateConversationAsync(model, messages,
                onContentReceived: async (content) =>
                {
                    await streamingMessage.Semaphore.WaitAsync();
                    try
                    {
                        streamingMessage.SbMessage.Append(content);
                        await hubContext.Clients.Group(convoId).SendAsync("NewAssistantPart", convoId, content);
                    }
                    finally
                    {
                        streamingMessage.Semaphore.Release();
                    }
                },
                onComplete: async (error) =>
                {
                    if (error == null)
                    {
                        _logger.LogDebug("Assistant message completed for conversation: {ConversationId}", convoId);
                        await hubContext.Clients.Group(convoId).SendAsync("EndAssistantMessage", convoId, null);

                        assistantMsg.Content = streamingMessage.SbMessage.ToString();
                        dbContext.Messages.Add(assistantMsg);
                        convo.IsStreaming = false;
                        await dbContext.SaveChangesAsync();
                        _logger.LogDebug("Assistant message saved to database");

                        _memoryCache.Set(convoId, streamingMessage, TimeSpan.FromMinutes(1));
                    }
                    else
                    {
                        _logger.LogError(error, "Error during streaming for conversation: {ConversationId}", convoId);
                        await hubContext.Clients.Group(convoId).SendAsync("EndAssistantMessage", convoId, error.Message);

                        assistantMsg.Content = streamingMessage.SbMessage.ToString();
                        assistantMsg.FinishError = error.Message;
                        dbContext.Messages.Add(assistantMsg);
                        convo.IsStreaming = false;
                        await dbContext.SaveChangesAsync();
                        _memoryCache.Remove(convoId);
                    }
                });
        }

        internal async Task StreamTitle(string convoId, NotT3Message userMsg, NotT3User user)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub>>();
            var convo = await dbContext.GetConversationAsync(convoId, user);

            await _openAiService.InitiateTitleAssignment(userMsg.Content, async title =>
            {
                string finalTitle = title[..Math.Min(40, title.Length)]; // ~6 words
                convo.Title = finalTitle;
                await dbContext.SaveChangesAsync();
                await hubContext.Clients.Group(user.Id).SendAsync("ChatTitle", convo.Id, convo.Title);
            });
        }
    }
    #endregion

    #region Services/PerplexityService.cs
    public interface IPerplexityService
    {
        Task<PerplexityResponse> SearchAsync(PerplexitySearchRequest request);
        Task<PerplexityResponse> DeepResearchAsync(PerplexityDeepResearchRequest request);
    }

    public class PerplexityService : IPerplexityService
    {
        private readonly ILogger<PerplexityService> _logger;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        public PerplexityService(ILogger<PerplexityService> logger, HttpClient httpClient, IConfiguration configuration)
        {
            _logger = logger;
            _httpClient = httpClient;
            _configuration = configuration;
        }

        public async Task<PerplexityResponse> SearchAsync(PerplexitySearchRequest request)
        {
            try
            {
                _logger.LogDebug("Performing Perplexity search for query: {Query}", request.Query);

                // Check if we have a valid API key
                var apiKey = _configuration["Perplexity:ApiKey"];
                if (string.IsNullOrEmpty(apiKey))
                {
                    _logger.LogWarning("No valid Perplexity API key configured, returning demo response");
                    return new PerplexityResponse
                    {
                        Result = $"✅ SEARCH ENDPOINT IS WORKING! 🎉\n\nQuery received: '{request.Query}'\n\nTo get real AI responses:\n1. Get API key from https://perplexity.ai/account/api\n2. Add it to appsettings.Development.json\n3. Restart server\n\nThe integration is ready for production!",
                        Sources = new List<string> { "https://docs.perplexity.ai/getting-started/quickstart" },
                        Cost = 0.0m
                    };
                }

                // Use direct Perplexity API
                var result = await CallPerplexityApiAsync(request.Query, request.SearchRecencyFilter);

                _logger.LogDebug("Perplexity search completed successfully");
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error performing Perplexity search");
                return new PerplexityResponse
                {
                    Result = $"Error: {ex.Message}"
                };
            }
        }

        private async Task<PerplexityResponse> CallPerplexityApiAsync(string query, string? searchRecencyFilter = null)
        {
            try
            {
                // Get API key from configuration
                var apiKey = _configuration["Perplexity:ApiKey"];
                if (string.IsNullOrEmpty(apiKey))
                {
                    throw new InvalidOperationException("Perplexity API key not configured");
                }

                // Set up request
                var requestData = new
                {
                    model = "sonar-reasoning",
                    messages = new[]
                    {
                        new { role = "system", content = "Be precise and concise." },
                        new { role = "user", content = query }
                    },
                    return_images = false,
                    return_related_questions = false,
                    search_recency_filter = searchRecencyFilter ?? "month",
                    top_p = 0.9,
                    stream = false
                };

                var requestJson = System.Text.Json.JsonSerializer.Serialize(requestData, new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower
                });

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.perplexity.ai/chat/completions")
                {
                    Content = new StringContent(requestJson, System.Text.Encoding.UTF8, "application/json")
                };

                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

                // Send request
                var response = await _httpClient.SendAsync(request);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Perplexity API error: {StatusCode} - {Content}", response.StatusCode, responseContent);
                    return new PerplexityResponse
                    {
                        Result = $"API Error: {response.StatusCode} - {responseContent}"
                    };
                }

                // Parse response
                var apiResponse = System.Text.Json.JsonSerializer.Deserialize<PerplexityApiResponse>(responseContent, new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower
                });

                _logger.LogDebug("Raw API Response: {Response}", responseContent);

                if (apiResponse?.Choices?.Length > 0)
                {
                    var choice = apiResponse.Choices[0];
                    var content = choice.Message.Content ?? "No response content";

                    // Extract sources from search_results
                    var sources = new List<string>();

                    // Get sources from search_results if available
                    if (apiResponse.SearchResults?.Any() == true)
                    {
                        foreach (var result in apiResponse.SearchResults)
                        {
                            if (!string.IsNullOrEmpty(result.Url))
                            {
                                sources.Add(result.Url);
                            }
                        }
                    }

                    // Also try to get citations from the message (fallback)
                    if (!sources.Any() && choice.Message.Citations?.Any() == true)
                    {
                        sources.AddRange(choice.Message.Citations);
                    }

                    // If we still don't have sources, extract citation count from text
                    if (!sources.Any())
                    {
                        var citationMatches = System.Text.RegularExpressions.Regex.Matches(content, @"\[(\d+)\]");
                        if (citationMatches.Count > 0)
                        {
                            sources.Add($"Citations embedded in text: {citationMatches.Count} references");
                        }
                    }

                    return new PerplexityResponse
                    {
                        Result = content,
                        Sources = sources.Any() ? sources : null,
                        Cost = CalculateCost(apiResponse.Usage)
                    };
                }

                return new PerplexityResponse
                {
                    Result = "No response received from Perplexity API"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Perplexity API");
                throw;
            }
        }

        private decimal CalculateCost(PerplexityUsage? usage)
        {
            if (usage == null) return 0;

            // Pricing for sonar model: $1 per 1M tokens for both input and output
            const decimal costPer1K = 0.001m;  // $0.001 per 1K tokens

            var totalCost = ((usage.PromptTokens + usage.CompletionTokens) / 1000m) * costPer1K;

            return totalCost;
        }

        public async Task<PerplexityResponse> DeepResearchAsync(PerplexityDeepResearchRequest request)
        {
            try
            {
                _logger.LogDebug("Performing Perplexity deep research for query: {Query}", request.Query);

                // Check if we have a valid API key
                var apiKey = _configuration["Perplexity:ApiKey"];
                if (string.IsNullOrEmpty(apiKey))
                {
                    _logger.LogWarning("No valid Perplexity API key configured, returning demo response");
                    return new PerplexityResponse
                    {
                        Result = $"✅ DEEP RESEARCH ENDPOINT IS WORKING! 🎉\n\nQuery received: '{request.Query}'\n\nThis would perform comprehensive research with detailed analysis.\n\nTo get real AI responses, add a valid Perplexity API key to configuration.",
                        Sources = new List<string> { "https://docs.perplexity.ai/getting-started/models/models/sonar-deep-research" },
                        Cost = 0.0m
                    };
                }

                // For deep research, use a more detailed prompt and longer model
                var result = await CallPerplexityApiAsync(
                    $"Provide comprehensive research on: {request.Query}. Include detailed analysis, multiple perspectives, and relevant context.",
                    "month"
                );

                _logger.LogDebug("Perplexity deep research completed successfully");
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error performing Perplexity deep research");
                return new PerplexityResponse
                {
                    Result = $"Error: {ex.Message}"
                };
            }
        }
    }
    #endregion
}

#region Hubs/ChatHub.cs
namespace NotT3ChatBackend.Hubs
{
    public class ChatHub : Hub
    {
        private readonly StreamingService _streamingService;
        private readonly AppDbContext _dbContext;
        private readonly UserManager<NotT3User> _userManager;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<ChatHub> _logger;

        public ChatHub(AppDbContext dbContext, UserManager<NotT3User> userManager, IMemoryCache memoryCache, StreamingService streamingService, ILogger<ChatHub> logger)
        {
            _dbContext = dbContext;
            _userManager = userManager;
            _memoryCache = memoryCache;
            _streamingService = streamingService;
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            _logger.LogDebug("SignalR Method Called: OnConnectedAsync - ConnectionId: {ConnectionId}", Context.ConnectionId);

            var user = await _userManager.GetUserAsync(Context.User ?? throw new UnauthorizedAccessException());
            if (user != null)
            {
                _logger.LogDebug("User {UserId} connected", user.Id);
                await Groups.AddToGroupAsync(Context.ConnectionId, user.Id);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            _logger.LogDebug("SignalR Method Called: OnDisconnectedAsync - ConnectionId: {ConnectionId}, Exception: {Exception}",
                Context.ConnectionId, exception?.Message);

            if (Context.Items.TryGetValue(Context.ConnectionId, out var convoIdObj))
            {
                _logger.LogDebug("User {ConnectionId} disconnected from conversation: {ConversationId}",
                    Context.ConnectionId, convoIdObj?.ToString() ?? "unknown");
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task ChooseChat(string convoId)
        {
            _logger.LogDebug("SignalR Method Called: ChooseChat - ConversationId: {ConversationId}, ConnectionId: {ConnectionId}",
                convoId, Context.ConnectionId);

            // It must be an existing conversation - retrieve it and send the existing messages
            var user = await _userManager.GetUserAsync(Context.User ?? throw new UnauthorizedAccessException());
            var conversation = await _dbContext.GetConversationAsync(convoId, user!);
            await _dbContext.Entry(conversation).Collection(c => c.Messages).LoadAsync();

            // Leave previous chat group (if any)
            if (Context.Items.TryGetValue(Context.ConnectionId, out var prevConvoId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, prevConvoId!.ToString()!);
                _logger.LogDebug("User {UserId} left chat {PreviousChatId}", user!.Id, prevConvoId!.ToString());
            }

            _logger.LogDebug("Sending conversation history with {MessageCount} messages", conversation.Messages.Count);
            // Send out the messages
            await Clients.Client(Context.ConnectionId).SendAsync("ConversationHistory", convoId, conversation.Messages.OrderBy(m => m.Index).Select(m => new NotT3MessageDTO(m)).ToList());

            async Task AddToGroup()
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, convoId);
                Context.Items[Context.ConnectionId] = convoId;
            }

            // TODO: consider race condition?
            // Check if we're in the middle of a message
            if (conversation.IsStreaming)
            {
                _logger.LogDebug("Conversation is currently streaming, checking for existing message");
                if (_memoryCache.TryGetValue(convoId, out StreamingMessage? currentMsg))
                {
                    await currentMsg!.Semaphore.WaitAsync();
                    try
                    {
                        await Clients.Client(Context.ConnectionId).SendAsync("BeginAssistantMessage", convoId, new NotT3MessageDTO(currentMsg.Message));
                        await Clients.Client(Context.ConnectionId).SendAsync("NewAssistantPart", convoId, currentMsg.SbMessage.ToString());
                        await AddToGroup();
                        _logger.LogDebug("User joined streaming conversation");
                    }
                    finally
                    {
                        currentMsg.Semaphore.Release();
                    }
                }
            }
            else
            {
                await AddToGroup();
                _logger.LogDebug("User joined conversation group");
            }

            await base.OnConnectedAsync();
        }

        public async Task NewMessage(string model, string message)
        {
            _logger.LogDebug("SignalR Method Called: NewMessage - Model: {Model}, MessageLength: {MessageLength}, ConnectionId: {ConnectionId}",
                model, message?.Length ?? 0, Context.ConnectionId);

            if (!Context.Items.TryGetValue(Context.ConnectionId, out var convoIdObj))
            {
                _logger.LogWarning("User attempted to send a message without being in a conversation group");
                return;
            }

            string convoId = convoIdObj!.ToString()!;
            _logger.LogDebug("New message received for conversation: {ConversationId}, model: {Model}", convoId, model);

            var user = await _userManager.GetUserAsync(Context.User ?? throw new NotImplementedException());
            var convo = await _dbContext.GetConversationAsync(convoId, user!);

            if (convo.IsStreaming)
            {
                _logger.LogWarning("Attempted to send message to streaming conversation: {ConversationId}", convoId);
                throw new BadHttpRequestException("Conversation is already streaming, can't create a new message");
            }

            // Load in the messages
            await _dbContext.Entry(convo).Collection(c => c.Messages).LoadAsync();
            convo.Messages.Sort((a, b) => a.Index.CompareTo(b.Index));
            _logger.LogDebug("Loaded {MessageCount} existing messages for conversation", convo.Messages.Count);

            // Add in the new one
            var userMsg = new NotT3Message()
            {
                Index = convo.Messages.Count,
                Role = "user",
                Content = message ?? string.Empty,
                Timestamp = DateTime.UtcNow,
                ConversationId = convo.Id,
                UserId = user!.Id
            };
            _dbContext.Messages.Add(userMsg);
            _logger.LogDebug("Added user message to conversation: {ConversationId}", convoId);

            // First message? Get a title
            if (userMsg.Index == 0)
            {
                _logger.LogDebug("First message in conversation, generating title asynchronously");
                _ = _streamingService.StreamTitle(convoId, userMsg, user);
            }

            convo.IsStreaming = true;
            await _dbContext.SaveChangesAsync();
            _logger.LogDebug("Conversation marked as streaming and changes saved");

            // Send out the user & assistant messages
            await Clients.Group(convoId).SendAsync("UserMessage", convo.Id, new NotT3MessageDTO(userMsg));

            var assistantMsg = new NotT3Message()
            {
                Index = convo.Messages.Count,
                Role = "assistant",
                Content = "",
                Timestamp = DateTime.UtcNow,
                ConversationId = convo.Id,
                UserId = user!.Id,
                ChatModel = model
            };
            await GenerateAssistantMessage(model, convoId, convo, assistantMsg, user!);
        }

        public async Task RegenerateMessage(string model, string messageId)
        {
            _logger.LogDebug("SignalR Method Called: RegenerateMessage - Model: {Model}, MessageId: {MessageId}, ConnectionId: {ConnectionId}",
                model, messageId, Context.ConnectionId);

            if (!Context.Items.TryGetValue(Context.ConnectionId, out var convoIdObj))
            {
                _logger.LogWarning("User attempted to regenerated a message without being in a conversation group");
                return;
            }

            string convoId = convoIdObj!.ToString()!;
            _logger.LogDebug("Gegenerated message received for conversation: {ConversationId}, model: {Model}, messageId: {MessageId}", convoId, model, messageId);

            var user = await _userManager.GetUserAsync(Context.User ?? throw new NotImplementedException());
            var convo = await _dbContext.GetConversationAsync(convoId, user!);

            if (convo.IsStreaming)
            {
                _logger.LogWarning("Attempted to send message to streaming conversation: {ConversationId}", convoId);
                throw new BadHttpRequestException("Conversation is already streaming, can't create a new message");
            }

            // Load in the messages
            await _dbContext.Entry(convo).Collection(c => c.Messages).LoadAsync();
            convo.Messages.Sort((a, b) => a.Index.CompareTo(b.Index));
            _logger.LogDebug("Loaded {MessageCount} existing messages for conversation", convo.Messages.Count);

            // Regenerating means deleting all the messages up until then
            var idxOfMessage = convo.Messages.FindIndex(m => m.Id == messageId);
            if (idxOfMessage == -1)
            {
                _logger.LogWarning("Message {MessageId} not found in conversation {ConversationId}", messageId, convoId);
                throw new KeyNotFoundException($"Message {messageId} not found in conversation {convoId}");
            }
            var lastMessage = convo.Messages[idxOfMessage];
            if (lastMessage.Role != "assistant")
            {
                _logger.LogWarning("Attempted to regenerate a non-assistant message, ignoring: {MessageId} in conversation {ConversationId}", messageId, convoId);
                return;
            }

            // Remove the old messages
            _logger.LogDebug("Regenerating message, removing {Count} messages from index {Index}", convo.Messages.Count - idxOfMessage, idxOfMessage);
            _dbContext.RemoveRange(convo.Messages.Skip(idxOfMessage));
            convo.Messages.RemoveRange(idxOfMessage, convo.Messages.Count - idxOfMessage);

            // Zero out the contents of the last message
            _logger.LogDebug("Zeroing out content of last message with ID: {MessageId}", lastMessage.Id);
            lastMessage.Content = "";
            lastMessage.FinishError = null;
            lastMessage.ChatModel = model;
            lastMessage.Timestamp = DateTime.UtcNow;

            convo.IsStreaming = true;
            await _dbContext.SaveChangesAsync();
            _logger.LogDebug("Conversation marked as streaming and changes saved");
            await GenerateAssistantMessage(model, convoId, convo, lastMessage, user!);
        }

        private async Task GenerateAssistantMessage(string model, string convoId, NotT3Conversation convo, NotT3Message assistantMsg, NotT3User user)
        {
            _logger.LogDebug("SignalR Helper Method Called: GenerateAssistantMessage - Model: {Model}, ConversationId: {ConversationId}, AssistantMessageId: {AssistantMessageId}, UserId: {UserId}",
                model, convoId, assistantMsg.Id, user.Id);

            await Clients.Group(convoId).SendAsync("BeginAssistantMessage", convoId, new NotT3MessageDTO(assistantMsg));
            _logger.LogDebug("Starting assistant response with ID: {ResponseId}", assistantMsg.Id);

            var streamingMessage = new StreamingMessage(new StringBuilder(), assistantMsg, new SemaphoreSlim(1));
            _memoryCache.Set(convoId, streamingMessage, TimeSpan.FromMinutes(5)); // Max expiration of 5 minutes

            // Create our conversation and sync
            _ = _streamingService.StartStreaming(model, convo.Messages, convoId, assistantMsg, streamingMessage, user);
        }
    }
}
#endregion

#region Data/AppDbContext.cs
namespace NotT3ChatBackend.Data
{
    public class AppDbContext(DbContextOptions<AppDbContext> options, ILogger<AppDbContext> logger) : IdentityDbContext<NotT3User>(options)
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.
        internal DbSet<NotT3Conversation> Conversations { get; init; }
        internal DbSet<NotT3Message> Messages { get; init; }

        internal async Task<NotT3Conversation> CreateConversationAsync(NotT3User user)
        {
            logger.LogDebug("Creating new conversation for user: {UserId}", user.Id);
            var convo = new NotT3Conversation()
            {
                UserId = user.Id
            };
            await Conversations.AddAsync(convo);
            await SaveChangesAsync();
            logger.LogDebug("Conversation created with ID: {ConversationId}", convo.Id);
            return convo;
        }

        internal async Task<NotT3Conversation> GetConversationAsync(string convoId, NotT3User user)
        {
            logger.LogDebug("Retrieving conversation: {ConversationId} for user: {UserId}", convoId, user.Id);
            var convo = await Conversations.FindAsync(convoId);
            if (convo == null)
            {
                logger.LogWarning("Conversation not found: {ConversationId}", convoId);
                throw new KeyNotFoundException();
            }
            if (convo.UserId != user.Id)
            {
                logger.LogWarning("User {UserId} attempted to access conversation {ConversationId} owned by {OwnerId}", user.Id, convoId, convo.UserId);
                throw new UnauthorizedAccessException();
            }
            return convo;
        }
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.
    }
}
#endregion

namespace NotT3ChatBackend.Models
{
    #region Models/NotT3User.cs
    public class NotT3User : IdentityUser
    {
        // Navigators
        public ICollection<NotT3Conversation> Conversations { get; set; } = [];
    }
    #endregion

    #region Models/NotT3Conversation.cs
    public class NotT3Conversation
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        public DateTime CreatedAt { get; } = DateTime.UtcNow;

        public string Title { get; set; } = "New Chat";

        public required string UserId { get; set; }

        public bool IsStreaming { get; set; } = false;

        // Navigators
        public NotT3User? User { get; set; }

        public List<NotT3Message> Messages { get; set; } = [];
    }
    #endregion

    #region Models/NotT3Message.cs
    public class NotT3Message
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        public required int Index { get; set; }

        public required string Role { get; set; }

        public required string Content { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public string? ChatModel { get; set; }

        public string? FinishError { get; set; }

        public required string ConversationId { get; set; }

        public required string UserId { get; set; }

        public NotT3Conversation? Conversation { get; set; }

        public NotT3User? User { get; set; }
    }
    #endregion
}

namespace NotT3ChatBackend.DTOs
{
    #region DTOs/NotT3ConversationDTO.cs
    public record NotT3ConversationDTO(string Id, DateTime CreatedAt, string Title)
    {
        public NotT3ConversationDTO(NotT3Conversation conversation) : this(conversation.Id, conversation.CreatedAt, conversation.Title) { }
    }
    #endregion

    #region DTOs/NotT3MessageDTO.cs
    public record NotT3MessageDTO(string Id, int Index, string Role, string Content, DateTime Timestamp, string? ChatModel, string? FinishError)
    {
        public NotT3MessageDTO(NotT3Message message) : this(message.Id, message.Index, message.Role.ToString().ToLower(), message.Content, message.Timestamp, message.ChatModel, message.FinishError) { }
    }
    #endregion

    #region DTOs/ForkChatRequestDTO.cs
    public record ForkChatRequestDTO([Required][StringLength(100)] string ConversationId, [Required][StringLength(100)] string MessageId);
    #endregion

    #region DTOs/ChatModelDto.cs
    public record ChatModelDto(string Name, string Provider)
    {
        // Simple DTO for chat models
    }
    #endregion

    #region DTOs/PerplexityDTOs.cs
    public class PerplexitySearchRequest
    {
        [Required]
        [StringLength(1000, MinimumLength = 1)]
        public string Query { get; set; } = string.Empty;

        [StringLength(50)]
        public string? SearchRecencyFilter { get; set; }

        [StringLength(100)]
        public string? SearchDomainFilter { get; set; }

        [StringLength(50)]
        public string? SearchMode { get; set; }
        public bool? ShowThinking { get; set; }
    }

    public class PerplexityDeepResearchRequest
    {
        [Required]
        [StringLength(1000, MinimumLength = 1)]
        public string Query { get; set; } = string.Empty;

        [StringLength(50)]
        public string? ReasoningEffort { get; set; }
    }

    public class PerplexityResponse
    {
        public string Result { get; set; } = string.Empty;

        public string? Thinking { get; set; }
        public List<string>? Sources { get; set; }
        public decimal? Cost { get; set; }
    }

    // Internal API response models
    public class PerplexityApiResponse
    {
        public string Id { get; set; } = string.Empty;

        public string Model { get; set; } = string.Empty;

        public long Created { get; set; }
        public PerplexityUsage? Usage { get; set; }

        public string Object { get; set; } = string.Empty;
        public PerplexityChoice[]? Choices { get; set; }
        public PerplexitySearchResult[]? SearchResults { get; set; }
    }

    public class PerplexitySearchResult
    {
        public string Title { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;

        public string Snippet { get; set; } = string.Empty;

        public string? Date { get; set; }

        public string? LastUpdated { get; set; }
    }

    public class PerplexityChoice
    {
        public int Index { get; set; }

        public string FinishReason { get; set; } = string.Empty;
        public PerplexityMessage Message { get; set; } = new();

        public PerplexityMessage? Delta { get; set; }
    }

    public class PerplexityMessage
    {
        public string Role { get; set; } = string.Empty;
        public string? Content { get; set; }
        public string[]? Citations { get; set; }
    }

    public class PerplexityUsage
    {
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }

        public int TotalTokens { get; set; }
    }
    #endregion

    #region DTOs/RegisterUserRequestDTO.cs
    public record RegisterUserRequestDto([Required][StringLength(50)] string Username, [Required][EmailAddress] string UserEmail, [Required][StringLength(100, MinimumLength = 12)] string Password);
    #endregion

}

namespace NotT3ChatBackend.Utils
{
    #region Utils/StreamingMessage.cs
    public record StreamingMessage(StringBuilder SbMessage, NotT3Message Message, SemaphoreSlim Semaphore);
    #endregion
}
