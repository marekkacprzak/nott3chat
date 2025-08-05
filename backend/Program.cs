using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.ComponentModel.DataAnnotations;
using Serilog;
using NotT3ChatBackend.Data;
using NotT3ChatBackend.Models;
using NotT3ChatBackend.Services;
using NotT3ChatBackend.Hubs;
using NotT3ChatBackend.DTOs;
using Microsoft.AspNetCore.Http.HttpResults;
using NotT3ChatBackend.Endpoints;
using NotT3ChatBackend.Utils;
using Microsoft.AspNetCore.Mvc;
using System.Text.RegularExpressions;
using Azure.AI.OpenAI;
using Azure.Identity;
using System.Text;
using Azure.Security.KeyVault.Secrets;
using System.Reflection;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption.ConfigurationModel;
using Serilog.Events;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
 
// This code is staying in one file for now as an intentional experiment for .NET 10's dotnet run app.cs feature,
// but we are aware of the importance of separating so we are currently assigning regions to be split when the time is right.

namespace NotT3ChatBackend
{
    #region Program.cs
    public class Program
    {
        public static async Task Main(string[] args)
        {
            await Task.Delay(0);
            var builder = WebApplication.CreateBuilder(args);

            // Add explicit environment variable configuration support
            builder.Configuration.AddEnvironmentVariables();
            builder.Configuration.AddUserSecrets(Assembly.GetExecutingAssembly());

            // Configure Serilog
            Log.Logger = new LoggerConfiguration()
                .WriteTo.Console()
                .MinimumLevel.Information()
                .Enrich.FromLogContext()
                .Enrich.WithProperty("Application", "NotT3ChatBackend")
                .Enrich.WithProperty("Environment", builder.Environment.EnvironmentName)
                .CreateBootstrapLogger();

            if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production")
            {
                builder.Services.AddApplicationInsightsTelemetry();
            }

            builder.Host.UseSerilog((context, services, loggerConfiguration) =>
            {
                var config = loggerConfiguration
                    .ReadFrom.Configuration(context.Configuration)
                    .ReadFrom.Services(services)
                    .Enrich.FromLogContext()
                    .Enrich.WithProperty("Application", "NotT3ChatBackend")
                    .Enrich.WithProperty("DeployTime", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"))
                    .Enrich.WithProperty("Environment", builder.Environment.EnvironmentName)
                    .WriteTo.Console(); // Continue console logging after startup (optional)
                if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production")
                {
                    config.WriteTo.ApplicationInsights(
                        context.Configuration["APPLICATIONINSIGHTS:CONNECTIONSTRING"],
                        TelemetryConverter.Traces,
                        restrictedToMinimumLevel: LogEventLevel.Information // You can adjust this level
                    );
                }
            });

            Console.WriteLine(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"));
 
            // Development path
            var connectionString = "Data Source=database.dat";
            if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production")
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
            builder.Services.AddCors(options =>
            {
                // This is OSS project, feel free to update this for your own use-cases
                options.AddPolicy("OpenCorsPolicy", policy =>
                {
                    policy.SetIsOriginAllowed(origin =>
                    {
                        Log.Information("CORS request from origin: {Origin}", origin);
                        return true; // Allow all origins for development
                    })
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials()
                    .SetPreflightMaxAge(TimeSpan.FromSeconds(86400)); // Cache preflight for 24 hours
                });
            });
            builder.Services.AddIdentityApiEndpoints<NotT3User>()
                        .AddRoles<IdentityRole>()
                        .AddEntityFrameworkStores<AppDbContext>()
                        .AddDefaultTokenProviders();
            
            // Add JWT Bearer authentication for SignalR
            var key = GetJwtSecretKey(builder.Configuration);

            builder.Services.AddAuthentication()
                .AddJwtBearer("SignalRBearer", options =>
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

                    // Configure JWT authentication for SignalR WebSocket connections
                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            var accessToken = context.Request.Query["access_token"];

                            // If the request is for our hub...
                            var path = context.HttpContext.Request.Path;
                            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/chat"))
                            {
                                // Read the token out of the query string
                                context.Token = accessToken;
                            }
                            return Task.CompletedTask;
                        }
                    };
                });

            builder.Services.ConfigureApplicationCookie(options =>
            {
                if (builder.Environment.IsProduction())
                {
                    options.Cookie.SameSite = SameSiteMode.None;
                    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                }
                options.Cookie.HttpOnly = true;
                options.SlidingExpiration = true;
                options.ExpireTimeSpan = TimeSpan.FromDays(1);
            });

            builder.Services.Configure<IdentityOptions>(options => {
                // This is OSS project, feel free to update this for your own use-cases
                options.SignIn.RequireConfirmedEmail = false;
                options.User.RequireUniqueEmail = true;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequireDigit = false;
                options.Password.RequiredLength = 5;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
            });
            
            builder.Services.AddSignalR();
            builder.Services.AddSingleton<IOpenAiService, ChatService>();
            builder.Services.AddScoped<StreamingService>();
            builder.Services.AddScoped<IPerplexityService, PerplexityService>();
            builder.Services.AddHttpClient<IPerplexityService, PerplexityService>();
            builder.Services.AddDataProtection().UseCryptographicAlgorithms(
                new AuthenticatedEncryptorConfiguration
                {
                    EncryptionAlgorithm = EncryptionAlgorithm.AES_256_CBC,
                    ValidationAlgorithm = ValidationAlgorithm.HMACSHA256
                });
            var app = builder.Build(); 

            // Initialize database and create admin user
            using (var scope = app.Services.CreateScope()) {
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var userManager = scope.ServiceProvider.GetRequiredService<UserManager<NotT3User>>();
                context.Database.EnsureCreated();
#if DEBUG
                Log.Information("Creating debug admin user");
                var adminUser = new NotT3User { UserName = "admin@example.com", Email = "admin@example.com" };
                var result = userManager.CreateAsync(adminUser, "admin").Result;
                if (result.Succeeded)
                    Log.Information("Admin user created successfully");
                else
                    Log.Warning("Failed to create admin user: {Errors}", string.Join(", ", result.Errors.Select(e => e.Description)));
#endif
            }

            Log.Information("Configuring HTTP pipeline");
            app.UseCors("OpenCorsPolicy");
            app.UseRouting();
            app.UseAuthentication();
            app.UseAuthorization();

            Log.Information("Mapping endpoints");
            app.MapGet("/health", (ILogger<Program> logger) =>
            {
                var testFileContent = DateTime.UtcNow.ToString("o");
                if (false && Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production")
                {
                    var dbPath = "/mnt/azurefileshare/database.dat";
                    var directory = Path.GetDirectoryName(dbPath);
                    testFileContent = File.ReadAllText(Path.Combine(directory!, "test.txt"));
                }
                logger.LogInformation("Health check requested");
                return TypedResults.Ok(testFileContent);
            });
            app.MapIdentityApi<NotT3User>();
            app.MapPost("/logout", async (SignInManager<NotT3User> signInManager) => {
                await signInManager.SignOutAsync();
                return TypedResults.Ok();
            }).RequireAuthorization();
            
            // JWT token endpoint for SignalR
            app.MapPost("/signalr-token", async (UserManager<NotT3User> userManager, HttpContext context, IConfiguration configuration) => {
                var user = await userManager.GetUserAsync(context.User);
                if (user == null) {
                    return Results.Unauthorized();
                }

                var key = GetJwtSecretKey(configuration);
                var tokenHandler = new JwtSecurityTokenHandler();
                var tokenDescriptor = new SecurityTokenDescriptor
                {
                    Subject = new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, user.Id),
                        new Claim(ClaimTypes.Name, user.UserName ?? user.Email ?? ""),
                        new Claim(ClaimTypes.Email, user.Email ?? "")
                    }),
                    Expires = DateTime.UtcNow.AddDays(1),
                    SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
                };

                var token = tokenHandler.CreateToken(tokenDescriptor);
                var tokenString = tokenHandler.WriteToken(token);

                return Results.Ok(new { token = tokenString });
            }).RequireAuthorization();
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
        public static async Task CreateUser(string userName, string email, string password, UserManager<NotT3User> userManager)
        {
            var user = new NotT3User { UserName = userName, Email = email };
            var result = await userManager.CreateAsync(user, password);
            if (!result.Succeeded)
            {
                throw new Exception($"Failed to create user: {string.Join(", ", result.Errors.Select(e => e.Description))}");
            }
        }
        private static byte[] GetJwtSecretKey(IConfiguration configuration)
        {
            var jwtSecretKey = configuration["Jwt:SecretKey"] ?? "ThisIsAVeryLongSecretKeyForJWTTokenGeneration123456789";
            return Encoding.ASCII.GetBytes(jwtSecretKey);
        }
    }
}

public static class Startup
{
}
#endregion

namespace NotT3ChatBackend.Endpoints
{
    #region Endpoints/ChatEndpoints.cs
    public class ChatEndpointsMarker;
    public static class ChatEndpoints
    {
        public static void MapChatEndpoints(this IEndpointRouteBuilder app)
        {
            app.MapHub<ChatHub>("/chat").RequireAuthorization(policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AuthenticationSchemes.Add(IdentityConstants.ApplicationScheme);
                policy.AuthenticationSchemes.Add(IdentityConstants.BearerScheme);
                policy.AuthenticationSchemes.Add("SignalRBearer"); // Add our custom JWT scheme for SignalR
            });
            app.MapPost("/chats/new", NewChat).RequireAuthorization();
            app.MapPost("/chats/fork", ForkChat).RequireAuthorization();
            app.MapDelete("/chats/{conversationId}", DeleteChat).RequireAuthorization();
            app.MapGet("/chats", GetChats).RequireAuthorization();
            app.MapPost("/register-user", RegisterUser);
        }

        public static async Task<NoContent> DeleteChat(string conversationId, AppDbContext dbContext, HttpContext context, UserManager<NotT3User> userManager, ILogger<ChatEndpointsMarker> logger, IHubContext<ChatHub> hubContext) {
            logger.LogInformation("Deleting conversation {ConversationId} for user", conversationId);
            try {
                var user = await userManager.GetUserAsync(context.User) ?? throw new UnauthorizedAccessException();
                var convo = await dbContext.GetConversationAsync(conversationId, user);
                dbContext.Conversations.Remove(convo);
                await dbContext.SaveChangesAsync();

                await hubContext.Clients.Group(user.Id).SendAsync("DeleteConversation", convo.Id);
                logger.LogInformation("Conversation {ConversationId} deleted successfully", conversationId);
                return TypedResults.NoContent();
            }
            catch (Exception ex) {
                logger.LogError(ex, "Error deleting conversation {ConversationId}", conversationId);
                throw;
            }
        }

        public static async Task<Ok<NotT3ConversationDTO>> ForkChat([FromBody] ForkChatRequestDTO request, AppDbContext dbContext, HttpContext context, UserManager<NotT3User> userManager, ILogger<ChatEndpointsMarker> logger, IHubContext<ChatHub> hubContext) {
            logger.LogInformation("Forking conversation {ConversationId} from message {MessageId} for user", request.ConversationId, request.MessageId);

            try {
                // Retrieve our conversation & messages
                var user = await userManager.GetUserAsync(context.User) ?? throw new UnauthorizedAccessException();
                var convo = await dbContext.GetConversationAsync(request.ConversationId, user);
                await dbContext.Entry(convo).Collection(c => c.Messages).LoadAsync();

                // Sort the messages by index, and find the message to fork from
                var messages = convo.Messages.OrderBy(m => m.Index).ToList();
                var forkIndex = messages.FindIndex(m => m.Id == request.MessageId);
                if (forkIndex == -1) {
                    logger.LogWarning("Message {MessageId} not found in conversation {ConversationId}", request.MessageId, request.ConversationId);
                    throw new KeyNotFoundException($"Message {request.MessageId} not found in conversation {request.ConversationId}"); 
                }

                // Create a new conversation with the forked messages
                logger.LogInformation("Forking conversation at index {ForkIndex} with {MessageCount} messages", forkIndex, messages.Count);
                var newConvo = await dbContext.CreateConversationAsync(user);
                // Copy the title from the original conversation - append (Fork), (Fork_2), ...
                newConvo.Title = convo.Title.Contains("(Branch")
                                        ? Regex.Replace(convo.Title, @"\(Branch(_\d+)?\)", m => $"(Branch_{(m.Groups[1].Success ? int.Parse(m.Groups[1].Value[1..]) + 1 : 2)})")
                                        : $"{convo.Title} (Branch)";

                // Fork the messages
                var forkedMessages = messages.Take(forkIndex + 1).Select(m => new NotT3Message() {
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
                logger.LogInformation("New conversation created with ID: {ConversationId}", convo.Id);
                return TypedResults.Ok(new NotT3ConversationDTO(newConvo));
            }
            catch (Exception ex) {
                logger.LogError(ex, "Error creating new conversation");
                throw;
            }
        }

        public static async Task<Ok<List<NotT3ConversationDTO>>> GetChats(AppDbContext dbContext, HttpContext context, UserManager<NotT3User> userManager, ILogger<ChatEndpointsMarker> logger) {
            logger.LogInformation("Retrieving conversations for user");
            try {
                var user = await userManager.GetUserAsync(context.User) ?? throw new UnauthorizedAccessException();
                await dbContext.Entry(user).Collection(u => u.Conversations).LoadAsync();
                var conversations = user.Conversations.OrderByDescending(c => c.CreatedAt)
                                                      .Select(c => new NotT3ConversationDTO(c)).ToList();
                logger.LogInformation("Retrieved {Count} conversations for user", conversations.Count);
                return TypedResults.Ok(conversations);
            }
            catch (Exception ex) {
                logger.LogError(ex, "Error retrieving conversations");
                throw;
            }
        }
        
        public static async Task<Ok<NotT3ConversationDTO>> NewChat(AppDbContext dbContext, HttpContext context, UserManager<NotT3User> userManager, ILogger<ChatEndpointsMarker> logger, IHubContext<ChatHub> hubContext) {
            logger.LogInformation("Creating new conversation for user");
            try {
                var user = await userManager.GetUserAsync(context.User) ?? throw new UnauthorizedAccessException();
                var convo = await dbContext.CreateConversationAsync(user);

                _ = hubContext.Clients.Group(user.Id).SendAsync("NewConversation", new NotT3ConversationDTO(convo));
                logger.LogInformation("New conversation created with ID: {ConversationId}", convo.Id);
                return TypedResults.Ok(new NotT3ConversationDTO(convo));
            }
            catch (Exception ex) {
                logger.LogError(ex, "Error creating new conversation");
                throw;
            }
        }

        public static async Task<Ok> RegisterUser([FromBody] RegisterUserRequestDto request, UserManager<NotT3User> userManager, ILogger<ChatEndpointsMarker> logger)
        {
            logger.LogInformation("Registering new user with username: {Username} and email: {Email}", request.Username, request.UserEmail);
            try
            {
                await Program.CreateUser(request.Username, request.UserEmail, request.Password, userManager);
                logger.LogInformation("User {Username} registered successfully", request.Username);
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
    public static class ModelEndpoints {
        public static void MapModelEndpoints(this IEndpointRouteBuilder app) {
            app.MapGet("/models", GetAvailableModels);
        }

        public static Ok<ICollection<ChatModelDto>> GetAvailableModels(IOpenAiService openAiService, ILogger<ModelEndpointsMarker> logger) {
            var models = openAiService.GetAvailableModels();
            logger.LogInformation("Retrieved {Count} available models", models.Count);
            return TypedResults.Ok(models);
        }
    }
    #endregion
}

namespace NotT3ChatBackend.Services {
    #region Services/IOpenAIService.cs
    public interface IOpenAiService {
        ICollection<ChatModelDto> GetAvailableModels();
        Task InitiateConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete);
        Task InitiateTitleAssignment(string initialMessage, Func<string, ValueTask> onComplete);
    }
    #endregion

    #region Services/ChatService.cs
    public class ChatService : IOpenAiService {
        private readonly ILogger<ChatService> _logger;
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;
        private readonly string[] _models;
        private readonly string? _titleModel;
        private readonly bool _useOpenAi;
        private readonly AzureOpenAIClient? _azureClient;
        private readonly IPerplexityService _perplexityService;

        public ChatService(ILogger<ChatService> logger, IConfiguration configuration, IPerplexityService perplexityService) {
            _logger = logger;
            _configuration = configuration;
            _httpClient = new HttpClient();
            _perplexityService = perplexityService;

            // Check OpenAI configuration first (preferred)
            var openAiApiKey = configuration["OpenAI:ApiKey"] ?? GetOpenApiKeyFromVault(configuration);
            if (!string.IsNullOrEmpty(openAiApiKey))
            {
                _useOpenAi = true;
                _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", openAiApiKey);
                var modelsConfig = configuration.GetSection("OpenAI:Models").Get<string[]>();
                _models = modelsConfig ?? ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
                _titleModel = configuration["OpenAI:TitleModel"] ?? "gpt-4o-mini";
                _logger.LogInformation("ChatService initialized with OpenAI API using {ModelCount} models", _models.Length);
            }
            else {
                // Fallback to Azure OpenAI
                _useOpenAi = false;
                var azureEndpoint = configuration["AzureOpenAI:Endpoint"];
                if (string.IsNullOrEmpty(azureEndpoint)) {
                    throw new InvalidOperationException("Either OpenAI:ApiKey or AzureOpenAI:Endpoint configuration is required");
                }

                var credential = new DefaultAzureCredential();
                _azureClient = new AzureOpenAIClient(new Uri(azureEndpoint), credential);
                
                var modelsConfig = configuration.GetSection("AzureOpenAI:Models").Get<string[]>();
                _models = modelsConfig ?? ["gpt-4o-mini", "gpt-4o", "gpt-35-turbo"];
                _titleModel = configuration["AzureOpenAI:TitleModel"] ?? "gpt-4o-mini";
                _logger.LogInformation("ChatService initialized with Azure OpenAI using {ModelCount} models", _models.Length);
            }
        }

        private static string GetOpenApiKeyFromVault(IConfiguration configuration)
        {
            // Add Azure Key Vault Configuration
            var keyVaultUrl = configuration["KeyVaultUrl"];
            if (!string.IsNullOrEmpty(keyVaultUrl))
            {
                var secretClient = new SecretClient(new Uri(keyVaultUrl), new DefaultAzureCredential());
                // Example: Retrieve a secret
                var secret = secretClient.GetSecret("OpenApiKey");
                return secret.Value.Value;
            }

            return string.Empty;
        }

        public ICollection<ChatModelDto> GetAvailableModels()
        {
            var provider = _useOpenAi ? "OpenAI" : "Azure OpenAI";
            return _models.Select(m => new ChatModelDto(m, provider)).ToList();
        }

        public async Task InitiateConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete) {
            _logger.LogInformation("Initiating conversation with model: {Model}, message count: {MessageCount}, provider: {Provider}", 
                model, messages.Count, _useOpenAi ? "OpenAI" : "Azure OpenAI");

            try {
                // Handle Perplexity model differently
                if (model.Equals("perplexity", StringComparison.OrdinalIgnoreCase))
                {
                    await InitiatePerplexityConversationAsync(model, messages, onContentReceived, onComplete);
                }
                else if (_useOpenAi) {
                    await InitiateOpenAIConversationAsync(model, messages, onContentReceived, onComplete);
                }
                else {
                    await InitiateAzureConversationAsync(model, messages, onContentReceived, onComplete);
                }
            }
            catch (Exception ex) {
                await onComplete(ex);
                _logger.LogError(ex, "Error during conversation streaming");
                throw;
            }
        }

        private async Task InitiateOpenAIConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete) {
            var requestBody = new {
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

            while (await reader.ReadLineAsync() is { } line) {
                if (line.StartsWith("data: ")) {
                    var data = line.Substring(6);
                    if (data == "[DONE]") {
                        break;
                    }

                    try {
                        using var jsonDoc = System.Text.Json.JsonDocument.Parse(data);
                        var choices = jsonDoc.RootElement.GetProperty("choices");
                        if (choices.GetArrayLength() > 0) {
                            var delta = choices[0].GetProperty("delta");
                            if (delta.TryGetProperty("content", out var contentElement)) {
                                var contentText = contentElement.GetString();
                                if (!string.IsNullOrEmpty(contentText)) {
                                    contentBuilder.Append(contentText);
                                    await onContentReceived(contentText);
                                }
                            }
                        }
                    }
                    catch (System.Text.Json.JsonException) {
                        // Skip malformed JSON lines
                        continue;
                    }
                }
            }

            await onComplete(null);
            _logger.LogInformation("OpenAI conversation streaming completed");
        }

        private async Task InitiatePerplexityConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete) {
            try {
                _logger.LogInformation("Starting Perplexity conversation");
                
                // Get the last message as the search query
                var lastMessage = messages.LastOrDefault();
                if (lastMessage == null || string.IsNullOrEmpty(lastMessage.Content)) {
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
                
                if (!string.IsNullOrEmpty(searchResult.Result)) {
                    // Stream the content back
                    await onContentReceived(searchResult.Result);
                    
                    // Add sources if available
                    if (searchResult.Sources != null && searchResult.Sources.Any()) {
                        var sourcesText = "\n\n**Sources:**\n" + string.Join("\n", searchResult.Sources.Select((s, i) => $"{i + 1}. {s}"));
                        await onContentReceived(sourcesText);
                    }
                } else {
                    var errorMessage = "Perplexity search failed: No results returned";
                    await onContentReceived(errorMessage);
                }
                
                await onComplete(null);
                _logger.LogInformation("Perplexity conversation completed");
            }
            catch (Exception ex) {
                _logger.LogError(ex, "Error during Perplexity conversation");
                await onComplete(ex);
            }
        }

        private async Task InitiateAzureConversationAsync(string model, ICollection<NotT3Message> messages, Func<string, ValueTask> onContentReceived, Func<Exception?, ValueTask> onComplete) {
            if (_azureClient == null) {
                throw new InvalidOperationException("Azure OpenAI client is not initialized");
            }

            var chatClient = _azureClient.GetChatClient(model);
            var chatMessages = messages.Select(m => CreateAzureChatMessage(m.Role, m.Content)).ToList();
            
            var response = chatClient.CompleteChatStreamingAsync(chatMessages);
            var contentBuilder = new StringBuilder();

            await foreach (var update in response) {
                if (update.ContentUpdate.Count > 0) {
                    var content = string.Join("", update.ContentUpdate.Select(c => c.Text ?? ""));
                    if (!string.IsNullOrEmpty(content)) {
                        contentBuilder.Append(content);
                        await onContentReceived(content);
                    }
                }
            }

            await onComplete(null);
            _logger.LogInformation("Azure OpenAI conversation streaming completed");
        }

        public async Task InitiateTitleAssignment(string initialMessage, Func<string, ValueTask> onComplete) {
            if (_titleModel is null) {
                _logger.LogWarning("Title model is not configured, skipping title assignment");
                return;
            }

            _logger.LogInformation("Initiating title assignment with model: {Model}, provider: {Provider}", 
                _titleModel, _useOpenAi ? "OpenAI" : "Azure OpenAI");

            try {
                if (_useOpenAi) {
                    await InitiateOpenAiTitleAssignmentAsync(initialMessage, onComplete);
                }
                else {
                    await InitiateAzureTitleAssignmentAsync(initialMessage, onComplete);
                }
            }
            catch (Exception ex) {
                _logger.LogError(ex, "Error during title assignment");
            }
        }

        private async Task InitiateOpenAiTitleAssignmentAsync(string initialMessage, Func<string, ValueTask> onComplete) {
            var requestBody = new {
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
            if (choices.GetArrayLength() > 0) {
                var title = choices[0].GetProperty("message").GetProperty("content").GetString() ?? "New Chat";
                _logger.LogInformation("OpenAI title assignment completed: {Title}", title);
                await onComplete(title);
            }
        }

        private async Task InitiateAzureTitleAssignmentAsync(string initialMessage, Func<string, ValueTask> onComplete) {
            if (_azureClient == null) {
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
            _logger.LogInformation("Azure title assignment completed: {Title}", title);

            await onComplete(title);
        }

        private static OpenAI.Chat.ChatMessage CreateAzureChatMessage(string role, string content) {
            return role.ToLower() switch {
                "user" => OpenAI.Chat.ChatMessage.CreateUserMessage(content),
                "assistant" => OpenAI.Chat.ChatMessage.CreateAssistantMessage(content),
                "system" => OpenAI.Chat.ChatMessage.CreateSystemMessage(content),
                _ => throw new ArgumentException($"Unknown role: {role}", nameof(role))
            };
        }
    }
    #endregion

    #region Services/StreamingService.cs
    public class StreamingService {
        private readonly IOpenAiService _openAiService;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<StreamingService> _logger;
        public StreamingService(IOpenAiService openAiService, IServiceScopeFactory scopeFactory, IMemoryCache memoryCache, ILogger<StreamingService> logger) {
            _openAiService = openAiService;
            _scopeFactory = scopeFactory;
            _memoryCache = memoryCache;
            _logger = logger;
        }
        internal async Task StartStreaming(string model, ICollection<NotT3Message> messages, string convoId, NotT3Message assistantMsg, StreamingMessage streamingMessage, NotT3User user) {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub>>();
            var convo = await dbContext.GetConversationAsync(convoId, user);

            await _openAiService.InitiateConversationAsync(model, messages,
                onContentReceived: async (content) => {
                    await streamingMessage.Semaphore.WaitAsync();
                    try {
                        streamingMessage.SbMessage.Append(content);
                        await hubContext.Clients.Group(convoId).SendAsync("NewAssistantPart", convoId, content);
                    }
                    finally {
                        streamingMessage.Semaphore.Release();
                    }
                },
                onComplete: async (error) => {
                    if (error == null) {
                        _logger.LogInformation("Assistant message completed for conversation: {ConversationId}", convoId);
                        await hubContext.Clients.Group(convoId).SendAsync("EndAssistantMessage", convoId, null);

                        assistantMsg.Content = streamingMessage.SbMessage.ToString();
                        dbContext.Messages.Add(assistantMsg);
                        convo.IsStreaming = false;
                        await dbContext.SaveChangesAsync();
                        _logger.LogInformation("Assistant message saved to database");

                        _memoryCache.Set(convoId, streamingMessage, TimeSpan.FromMinutes(1));
                    }
                    else {
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

        internal async Task StreamTitle(string convoId, NotT3Message userMsg, NotT3User user) {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub>>();
            var convo = await dbContext.GetConversationAsync(convoId, user);

            await _openAiService.InitiateTitleAssignment(userMsg.Content, async title => {
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
                _logger.LogInformation("Performing Perplexity search for query: {Query}", request.Query);

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
                
                _logger.LogInformation("Perplexity search completed successfully");
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
                _logger.LogInformation("Performing Perplexity deep research for query: {Query}", request.Query);

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

                _logger.LogInformation("Perplexity deep research completed successfully");
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
namespace NotT3ChatBackend.Hubs {
    public class ChatHub : Hub {
        private readonly StreamingService _streamingService;
        private readonly AppDbContext _dbContext;
        private readonly UserManager<NotT3User> _userManager;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<ChatHub> _logger;
        
        public ChatHub(AppDbContext dbContext, UserManager<NotT3User> userManager, IMemoryCache memoryCache, StreamingService streamingService, ILogger<ChatHub> logger) {
            _dbContext = dbContext;
            _userManager = userManager;
            _memoryCache = memoryCache;
            _streamingService = streamingService;
            _logger = logger;
        }

        public override async Task OnConnectedAsync() {
            var user = await _userManager.GetUserAsync(Context.User ?? throw new UnauthorizedAccessException());
            if (user != null) {
                _logger.LogInformation("User {UserId} connected", user.Id);
                await Groups.AddToGroupAsync(Context.ConnectionId, user.Id);
            }
            await base.OnConnectedAsync();
        }

        public async Task ChooseChat(string convoId) { 
            _logger.LogInformation("User connecting to conversation: {ConversationId}", convoId);

            // It must be an existing conversation - retrieve it and send the existing messages
            var user = await _userManager.GetUserAsync(Context.User ?? throw new UnauthorizedAccessException());
            var conversation = await _dbContext.GetConversationAsync(convoId, user!);
            await _dbContext.Entry(conversation).Collection(c => c.Messages).LoadAsync();

            // Leave previous chat group (if any)
            if (Context.Items.TryGetValue(Context.ConnectionId, out var prevConvoId)) { 
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, prevConvoId!.ToString()!);
                _logger.LogInformation("User {UserId} left chat {PreviousChatId}", user!.Id, prevConvoId!.ToString());
            }

            _logger.LogInformation("Sending conversation history with {MessageCount} messages", conversation.Messages.Count);
            // Send out the messages
            await Clients.Client(Context.ConnectionId).SendAsync("ConversationHistory", convoId, conversation.Messages.OrderBy(m => m.Index).Select(m => new NotT3MessageDTO(m)).ToList());

            async Task AddToGroup() {
                await Groups.AddToGroupAsync(Context.ConnectionId, convoId);
                Context.Items[Context.ConnectionId] = convoId;
            }

            // TODO: consider race condition?
            // Check if we're in the middle of a message
            if (conversation.IsStreaming) {
                _logger.LogInformation("Conversation is currently streaming, checking for existing message");
                if (_memoryCache.TryGetValue(convoId, out StreamingMessage? currentMsg)) {
                    await currentMsg!.Semaphore.WaitAsync();
                    try {
                        await Clients.Client(Context.ConnectionId).SendAsync("BeginAssistantMessage", convoId, new NotT3MessageDTO(currentMsg.Message));
                        await Clients.Client(Context.ConnectionId).SendAsync("NewAssistantPart", convoId, currentMsg.SbMessage.ToString());
                        await AddToGroup();
                        _logger.LogInformation("User joined streaming conversation");
                    }
                    finally {
                        currentMsg.Semaphore.Release();
                    }
                }
            }
            else {
                await AddToGroup();
                _logger.LogInformation("User joined conversation group");
            }

            await base.OnConnectedAsync();
        }

        public async Task NewMessage(string model, string message) {
            if (!Context.Items.TryGetValue(Context.ConnectionId, out var convoIdObj)) {
                _logger.LogWarning("User attempted to send a message without being in a conversation group");
                return;
            }

            string convoId = convoIdObj!.ToString()!;
            _logger.LogInformation("New message received for conversation: {ConversationId}, model: {Model}", convoId, model);

            var user = await _userManager.GetUserAsync(Context.User ?? throw new NotImplementedException());
            var convo = await _dbContext.GetConversationAsync(convoId, user!);

            if (convo.IsStreaming) {
                _logger.LogWarning("Attempted to send message to streaming conversation: {ConversationId}", convoId);
                throw new BadHttpRequestException("Conversation is already streaming, can't create a new message");
            }

            // Load in the messages
            await _dbContext.Entry(convo).Collection(c => c.Messages).LoadAsync();
            convo.Messages.Sort((a, b) => a.Index.CompareTo(b.Index));
            _logger.LogInformation("Loaded {MessageCount} existing messages for conversation", convo.Messages.Count);

            // Add in the new one
            var userMsg = new NotT3Message() {
                Index = convo.Messages.Count,
                Role = "user",
                Content = message,
                Timestamp = DateTime.UtcNow,
                ConversationId = convo.Id,
                UserId = user!.Id
            };
            _dbContext.Messages.Add(userMsg);
            _logger.LogInformation("Added user message to conversation: {ConversationId}", convoId);

            // First message? Get a title
            if (userMsg.Index == 0) {
                _logger.LogInformation("First message in conversation, generating title asynchronously");
                _ = _streamingService.StreamTitle(convoId, userMsg, user);
            }

            convo.IsStreaming = true;
            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Conversation marked as streaming and changes saved");

            // Send out the user & assistant messages
            await Clients.Group(convoId).SendAsync("UserMessage", convo.Id, new NotT3MessageDTO(userMsg));

            var assistantMsg = new NotT3Message() {
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

        public async Task RegenerateMessage(string model, string messageId) {
            if (!Context.Items.TryGetValue(Context.ConnectionId, out var convoIdObj)) {
                _logger.LogWarning("User attempted to regenerated a message without being in a conversation group");
                return;
            }

            string convoId = convoIdObj!.ToString()!;
            _logger.LogInformation("Gegenerated message received for conversation: {ConversationId}, model: {Model}, messageId: {MessageId}", convoId, model, messageId);

            var user = await _userManager.GetUserAsync(Context.User ?? throw new NotImplementedException());
            var convo = await _dbContext.GetConversationAsync(convoId, user!);

            if (convo.IsStreaming) {
                Log.Warning("Attempted to send message to streaming conversation: {ConversationId}", convoId);
                throw new BadHttpRequestException("Conversation is already streaming, can't create a new message");
            }

            // Load in the messages
            await _dbContext.Entry(convo).Collection(c => c.Messages).LoadAsync();
            convo.Messages.Sort((a, b) => a.Index.CompareTo(b.Index));
            _logger.LogInformation("Loaded {MessageCount} existing messages for conversation", convo.Messages.Count);

            // Regenerating means deleting all the messages up until then
            var idxOfMessage = convo.Messages.FindIndex(m => m.Id == messageId);
            if (idxOfMessage == -1) {
                _logger.LogWarning("Message {MessageId} not found in conversation {ConversationId}", messageId, convoId);
                throw new KeyNotFoundException($"Message {messageId} not found in conversation {convoId}");
            }
            var lastMessage = convo.Messages[idxOfMessage];
            if (lastMessage.Role != "assistant") {
                _logger.LogWarning("Attempted to regenerate a non-assistant message, ignoring: {MessageId} in conversation {ConversationId}", messageId, convoId);
                return; 
            }

            // Remove the old messages
            _logger.LogInformation("Regenerating message, removing {Count} messages from index {Index}", convo.Messages.Count - idxOfMessage, idxOfMessage);
            _dbContext.RemoveRange(convo.Messages.Skip(idxOfMessage));
            convo.Messages.RemoveRange(idxOfMessage, convo.Messages.Count - idxOfMessage);

            // Zero out the contents of the last message
            _logger.LogInformation("Zeroing out content of last message with ID: {MessageId}", lastMessage.Id);
            lastMessage.Content = "";
            lastMessage.FinishError = null;
            lastMessage.ChatModel = model;
            lastMessage.Timestamp = DateTime.UtcNow;

            convo.IsStreaming = true;
            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Conversation marked as streaming and changes saved");
            await GenerateAssistantMessage(model, convoId, convo, lastMessage, user!);
        }

        private async Task GenerateAssistantMessage(string model, string convoId, NotT3Conversation convo, NotT3Message assistantMsg, NotT3User user) {
            await Clients.Group(convoId).SendAsync("BeginAssistantMessage", convoId, new NotT3MessageDTO(assistantMsg));
            _logger.LogInformation("Starting assistant response with ID: {ResponseId}", assistantMsg.Id);

            var streamingMessage = new StreamingMessage(new StringBuilder(),assistantMsg, new SemaphoreSlim(1));
            _memoryCache.Set(convoId, streamingMessage, TimeSpan.FromMinutes(5)); // Max expiration of 5 minutes

            // Create our conversation and sync
            _ = _streamingService.StartStreaming(model, convo.Messages, convoId, assistantMsg, streamingMessage, user);
        }
    }
}
#endregion

#region Data/AppDbContext.cs
namespace NotT3ChatBackend.Data {
    public class AppDbContext(DbContextOptions<AppDbContext> options, ILogger<AppDbContext> logger) : IdentityDbContext<NotT3User>(options) {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.
        internal DbSet<NotT3Conversation> Conversations { get; init; }
        internal DbSet<NotT3Message> Messages { get; init; }

        internal async Task<NotT3Conversation> CreateConversationAsync(NotT3User user) {
            logger.LogInformation("Creating new conversation for user: {UserId}", user.Id);
            var convo = new NotT3Conversation() {
                UserId = user.Id
            };
            await Conversations.AddAsync(convo);
            await SaveChangesAsync();
            logger.LogInformation("Conversation created with ID: {ConversationId}", convo.Id);
            return convo;
        }

        internal async Task<NotT3Conversation> GetConversationAsync(string convoId, NotT3User user) {
            logger.LogDebug("Retrieving conversation: {ConversationId} for user: {UserId}", convoId, user.Id);
            var convo = await Conversations.FindAsync(convoId);
            if (convo == null) {
                logger.LogWarning("Conversation not found: {ConversationId}", convoId);
                throw new KeyNotFoundException();
            }
            if (convo.UserId != user.Id) {
                logger.LogWarning("User {UserId} attempted to access conversation {ConversationId} owned by {OwnerId}", user.Id, convoId, convo.UserId);
                throw new UnauthorizedAccessException();
            }
            return convo;
        }
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.
    }
}
#endregion

namespace NotT3ChatBackend.Models {
    #region Models/NotT3User.cs
    public class NotT3User : IdentityUser {
        // Navigators
        public ICollection<NotT3Conversation> Conversations { get; set; } = [];
    }
    #endregion

    #region Models/NotT3Conversation.cs
    public class NotT3Conversation {
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
    public class NotT3Message {
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

namespace NotT3ChatBackend.DTOs {
    #region DTOs/NotT3ConversationDTO.cs
    public record NotT3ConversationDTO(string Id, DateTime CreatedAt, string Title) {
        public NotT3ConversationDTO(NotT3Conversation conversation) : this(conversation.Id, conversation.CreatedAt, conversation.Title) { }
    }
    #endregion

    #region DTOs/NotT3MessageDTO.cs
    public record NotT3MessageDTO(string Id, int Index, string Role, string Content, DateTime Timestamp, string? ChatModel, string? FinishError) {
        public NotT3MessageDTO(NotT3Message message) : this(message.Id, message.Index, message.Role.ToString().ToLower(), message.Content, message.Timestamp, message.ChatModel, message.FinishError) { }
    }
    #endregion

    #region DTOs/ForkChatRequestDTO.cs
    public record ForkChatRequestDTO(string ConversationId, string MessageId);
    #endregion

    #region DTOs/ChatModelDto.cs
    public record ChatModelDto(string Name, string Provider) {
        // Simple DTO for chat models
    }
    #endregion

    #region DTOs/PerplexityDTOs.cs
    public class PerplexitySearchRequest
    {
        public string Query { get; set; } = string.Empty;
        public string? SearchRecencyFilter { get; set; }
        
        public string? SearchDomainFilter { get; set; }
        public string? SearchMode { get; set; }
        public bool? ShowThinking { get; set; }
    }

    public class PerplexityDeepResearchRequest
    {
        public string Query { get; set; } = string.Empty;
        
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
    public record RegisterUserRequestDto(string Username, string UserEmail, string Password);
    #endregion
}

namespace NotT3ChatBackend.Utils {
    #region Utils/StreamingMessage.cs
    public record StreamingMessage(StringBuilder SbMessage, NotT3Message Message, SemaphoreSlim Semaphore);
    #endregion
}