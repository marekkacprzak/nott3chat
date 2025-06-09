using LlmTornado.Chat.Models;
using LlmTornado.Code;
using LlmTornado;
using LlmTornado.Chat;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using System.Text;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.ComponentModel.DataAnnotations;

namespace NotT3ChatBackend;
public class Program {
    public static void Main(string[] args) {
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddDbContext<AppDbContext>(opt =>
                    // opt.UseInMemoryDatabase("DB"));
                    opt.UseSqlite("Data Source=databse.dat"));

        builder.Services.AddMemoryCache();
        builder.Services.AddAuthentication();
        builder.Services.AddAuthorization();
        builder.Services.AddEndpointsApiExplorer();

        // Add CORS services
        builder.Services.AddCors(options => {
            // Dynamic policy for specific routes (initially permissive, will be restricted in middleware)
            options.AddPolicy("DynamicCorsPolicy", policy => {
                policy.SetIsOriginAllowed(_ => true)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        builder.Services.AddIdentityApiEndpoints<NotT3User>()
                    .AddRoles<IdentityRole>()
                    .AddEntityFrameworkStores<AppDbContext>()
                    .AddDefaultTokenProviders();

        builder.Services.ConfigureApplicationCookie(options => {
            if (builder.Environment.IsProduction()) {
                options.Cookie.SameSite = SameSiteMode.None;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            }
            options.Cookie.HttpOnly = true;
            options.SlidingExpiration = true;
            options.ExpireTimeSpan = TimeSpan.FromDays(1);
        });

        builder.Services.Configure<IdentityOptions>(options => {
            options.SignIn.RequireConfirmedEmail = false; // If we are skipping, we don't need to confirm email
            options.User.RequireUniqueEmail = true;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequireDigit = false;
            options.Password.RequiredLength = 5;
            options.Password.RequireLowercase = false;
            options.Password.RequireUppercase = false;
        });

        builder.Services.AddSignalR();
        builder.Services.AddSingleton<TorandoService>();

        var app = builder.Build();
#if DEBUG
        // Initialize database and create admin user
        using (var scope = app.Services.CreateScope()) {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<NotT3User>>();

            context.Database.EnsureCreated();

            var adminUser = new NotT3User { UserName = "admin@example.com", Email = "admin@example.com" };
            userManager.CreateAsync(adminUser, "admin").Wait();
        }
#endif

        app.UseRouting();
        app.UseCors("DynamicCorsPolicy");

        // Configure the HTTP request pipeline.
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapGet("/health", () => TypedResults.Ok());
        app.MapIdentityApi<NotT3User>();
        app.MapHub<ChatHub>("/chat/{conversationId}").RequireAuthorization();
        app.MapPost("/chats/new", async (AppDbContext dbContext, HttpContext context, UserManager<NotT3User> userManager) => {
            var user = await userManager.GetUserAsync(context.User) ?? throw new UnauthorizedAccessException();
            var convo = await dbContext.CreateConversationAsync(user);

            return TypedResults.Ok(new NotT3ConversationDTO(convo));
        }).RequireAuthorization();
        app.MapGet("/chats", async (AppDbContext dbContext, HttpContext context, UserManager<NotT3User> userManager) => {
            var user = await userManager.GetUserAsync(context.User) ?? throw new UnauthorizedAccessException();
            await dbContext.Entry(user).Collection(u => u.Conversations).LoadAsync();

            return TypedResults.Ok(user.Conversations.OrderByDescending(c => c.CreatedAt)
                                                    .Select(c => new NotT3ConversationDTO(c)).ToList());
        }).RequireAuthorization();
        app.MapGet("/models", (TorandoService torandoService) => {
            // Return the available models
            return TypedResults.Ok(torandoService.GetAvailableModels());
        });

        app.Run();
    }
}

public class TorandoService {
    private readonly TornadoApi _api;
    private readonly ChatModel[] _models;

    public TorandoService() {
        var providerAuthentications = new List<ProviderAuthentication>();
        if (Environment.GetEnvironmentVariable("GOOGLE_API_KEY") is string googleApiKey && !string.IsNullOrEmpty(googleApiKey))
            providerAuthentications.Add(new ProviderAuthentication(LLmProviders.Google, googleApiKey));
        if (Environment.GetEnvironmentVariable("OAI_API_KEY") is string oaiApiKey && !string.IsNullOrEmpty(oaiApiKey))
            providerAuthentications.Add(new ProviderAuthentication(LLmProviders.OpenAi, oaiApiKey));

        _api = new TornadoApi(providerAuthentications);
        _models = [ChatModel.OpenAi.Gpt4.OMini, ChatModel.Google.Gemini.Gemini2Flash001];
    }

    public ICollection<ChatModelDTO> GetAvailableModels() {
        // Return the models that are available
        return _models.Select(m => new ChatModelDTO(m)).ToList();
    }

    public async Task InitiateConversationAsync(string model, ICollection<NotT3Message> messages, ChatStreamEventHandler handler) {
        var convo = _api.Chat.CreateConversation(model);
        foreach (var msg in messages)
            convo.AppendMessage(msg.Role, msg.Content);
        await convo.StreamResponseRich(handler);
    }

}

public record ChatModelDTO(string Name, string Provider) {
    public ChatModelDTO(ChatModel model) : this(model.Name, model.Provider.ToString()) {
        // This is a simple DTO, so we don't need to do anything else
    }
}

public class ChatHub : Hub {
    private readonly TorandoService _torandoService;
    private readonly AppDbContext _dbContext;
    private readonly UserManager<NotT3User> _userManager;
    private readonly IMemoryCache _memoryCache;
    public ChatHub(TorandoService torandoService, AppDbContext dbContext, UserManager<NotT3User> userManager, IMemoryCache memoryCache) {
        _torandoService = torandoService;
        _dbContext = dbContext;
        _userManager = userManager;
        _memoryCache = memoryCache;
    }

    public override async Task OnConnectedAsync() {

        string convoId = Context.GetHttpContext()!.Request.RouteValues["conversationId"]!.ToString()!;
        var user = await _userManager.GetUserAsync(Context.User ?? throw new NotImplementedException());

        // It must be an existing conversation - retrieve it and send the existing messages
        var conversation = await _dbContext.GetConversationAsync(convoId, user!);
        await _dbContext.Entry(conversation).Collection(c => c.Messages).LoadAsync();

        // Send out the messages
        await Clients.Client(Context.ConnectionId).SendAsync("ConversationHistory", conversation.Messages.OrderBy(m => m.Index).Select(m => new NotT3MessageDTO(m)).ToList());

        // TODO: consider race condition?
        // Check if we're in the middle of a message
        if (conversation.IsStreaming) {

            if (_memoryCache.TryGetValue(convoId, out StreamingMessage? currentMsg)) {
                await currentMsg!.semaphore.WaitAsync();
                try {
                    await Clients.Client(Context.ConnectionId).SendAsync("BeginAssistantMessage", DateTime.UtcNow.ToString()); // Store that in the cache too?
                    await Clients.Client(Context.ConnectionId).SendAsync("NewAssistantPart", currentMsg.sbMessage.ToString());
                    await Groups.AddToGroupAsync(Context.ConnectionId, convoId);
                }
                finally {
                    currentMsg.semaphore.Release();
                }
            }
        } else {
            await Groups.AddToGroupAsync(Context.ConnectionId, convoId);
        }

        await base.OnConnectedAsync();
    }

    public async Task NewMessage(string model, string message) {
        string? convoId = Context.GetHttpContext()!.Request.RouteValues["conversationId"]!.ToString()!;
        var user = await _userManager.GetUserAsync(Context.User ?? throw new NotImplementedException());
        var convo = await _dbContext.GetConversationAsync(convoId, user!);
            
        if (convo.IsStreaming)
            throw new BadHttpRequestException("Conversation is already streaming, can't create a new message");

        // Load in the messages
        await _dbContext.Entry(convo).Collection(c => c.Messages).LoadAsync();
        convo.Messages.Sort((a, b) => a.Index.CompareTo(b.Index));

        // Add in the new one
        var time = DateTime.UtcNow;
        _dbContext.Messages.Add(new NotT3Message() {
            Index = convo.Messages.Count,
            Role = ChatMessageRoles.User,
            Content = message,
            Timestamp = time,
            ConversationId = convo.Id,
            UserId = user!.Id
        });

        convo.IsStreaming = true;
        await _dbContext.SaveChangesAsync();

        // Send out the user & assistnat messages
        await Clients.Group(convoId).SendAsync("UserMessage", message, time.ToString());
        await Clients.Group(convoId).SendAsync("BeginAssistantMessage", time.ToString());

        var streamingMessage = new StreamingMessage(new StringBuilder(), new SemaphoreSlim(1));
        _memoryCache.Set(convoId, streamingMessage, TimeSpan.FromMinutes(5)); // Max expiration of 5 minutes
            
        // Create our conversation
        await _torandoService.InitiateConversationAsync(model, convo.Messages, new ChatStreamEventHandler() {
            MessagePartHandler = async (messagePart) => {
                await streamingMessage.semaphore.WaitAsync();
                try {
                    streamingMessage.sbMessage.Append(messagePart.Text);
                    await Clients.Group(convoId).SendAsync("NewAssistantPart", messagePart.Text);
                }
                finally {
                    streamingMessage.semaphore.Release();
                }
            },
            OnFinished = async (data) => {
                await Clients.Group(convoId).SendAsync("EndAssistantMessage");

                _dbContext.Messages.Add(new NotT3Message() {
                    Index = convo.Messages.Count,
                    Role = ChatMessageRoles.Assistant,
                    Content = streamingMessage.sbMessage.ToString(),
                    Timestamp = time,
                    ConversationId = convo.Id,
                    UserId = user!.Id
                });
                convo.IsStreaming = false;
                await _dbContext.SaveChangesAsync();

                _memoryCache.Set(convoId, streamingMessage, TimeSpan.FromMinutes(1));
            }
        });
    }

}

record StreamingMessage(StringBuilder sbMessage, SemaphoreSlim semaphore);

public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<NotT3User>(options) {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.
    internal DbSet<NotT3Conversation> Conversations { get; init; }
    internal DbSet<NotT3Message> Messages { get; init; }

    internal async Task<NotT3Conversation> CreateConversationAsync(NotT3User user) {
        var convo = new NotT3Conversation() {
            UserId = user.Id
        };
        await Conversations.AddAsync(convo);
        await SaveChangesAsync();

        return convo;
    }

    internal async Task<NotT3Conversation> GetConversationAsync(string convoId, NotT3User user) {
        var convo = await Conversations.FindAsync(convoId) ?? throw new KeyNotFoundException();
        if (convo.UserId != user.Id)
            throw new UnauthorizedAccessException();

        return convo;
    }
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider adding the 'required' modifier or declaring as nullable.
}

public class NotT3User : IdentityUser {
    // Navigators
    public ICollection<NotT3Conversation> Conversations { get; set; } = [];
}

public class NotT3Conversation {
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime CreatedAt { get; } = DateTime.UtcNow;

    public required string UserId { get; set; }
    public bool IsStreaming { get; set; } = false;

    // Navigators
    public NotT3User? User { get; set; }
    public List<NotT3Message> Messages { get; set; } = [];
}

public record NotT3ConversationDTO(string Id, DateTime CreatedAt) {
    public NotT3ConversationDTO(NotT3Conversation conversation) : this(conversation.Id, conversation.CreatedAt) {
    }
}

public class NotT3Message {
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public required int Index { get; set; }
    public required ChatMessageRoles Role { get; set; }
    public required string Content { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public required string ConversationId { get; set; }
    public required string UserId { get; set; }

    // Navigators
    public NotT3Conversation? Conversation { get; set; }
    public NotT3User? User { get; set; }
}
public record NotT3MessageDTO(string Id, int Index, string Role, string Content, DateTime Timestamp) {
    public NotT3MessageDTO(NotT3Message message) : this(message.Id, message.Index, message.Role.ToString().ToLower(), message.Content, message.Timestamp) {
    }
}
