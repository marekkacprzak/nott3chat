# WebChat: The C# Answer - fork from https://github.com/shaltielshmid/NotT3Chat
 <img src="stuff/logo.png" width="350" />


Welcome to **NotT3Chat** - a fully-featured, real-time chat application built for the . This project serves as a testament to the raw power and elegance of C# and ASP.NET Core, with TypeScript to build amazing, modern web applications.

*   **📱 Mobile-Optimized Experience:** The entire application is optimized for mobile devices. Features include:
  * Prevents unwanted page scrolling and zooming on input focus
  * Input area automatically adjusts position when the mobile keyboard is shown
  * Responsive layout and touch-friendly controls
  * Mobile console logger for debugging on iPhone and other devices

> **🔥 NEW: Now powered by Azure OpenAI with credential-based authentication and one-command Azure deployment!**  
> Deploy to Azure in minutes using the included `deploy-azure.ps1` script and full Terraform automation.

> Too much bullshit just take me to [Getting Started](#-getting-started).

### Check out the demo!

![](stuff/example.gif)

---

## 🤔 Why?

Why build yet another chat app based on an existing proof of concept?

1.  To learn TypeScript by converting a previous JavaScript project.
2.  To learn Azure by preparing a deployment script in Terraform.
3.  To make the app mobile-friendly and optimized for mobile devices.
4.  For fun.
5.  To playfully challenge the T3 stack and show that a robust, type-safe, high-performance application can be built with the powerful combination of **C# on the backend** and **TypeScript on the frontend**. It's a love letter to backend developers who appreciate strongly-typed languages and modern web development practices.


## ✨ Core Features

This is far from just a "hello world" chat. We've packed in some serious features:

- [x] **🤖 Azure OpenAI Integration:** Seamlessly integrated with Azure OpenAI services using credential-based authentication (no API keys required).
- [x] **🔍 Perplexity Search Integration:** Advanced search capabilities through Perplexity AI for comprehensive research and information retrieval.
- [x] **🏗️ Azure Infrastructure Automation:** Complete Terraform infrastructure-as-code for Azure deployment with configurable components:
  - Linux App Service with Docker container support and Azure Container Registry integration
  - Azure Key Vault for secure secrets management with managed identity authentication
  - Azure Static Web Apps for frontend hosting
  - Optional Windows redirect web app with .NET Framework 4.0 for nice DNS name for the web app
  - Azure Files storage mounting for persistent SQLite database storage
- [x] **⚡ Blazing-Fast Real-Time Chat:** Built with the magic of **[SignalR](https://dotnet.microsoft.com/apps/aspnet/signalr)**, messages stream in real-time.
- [x] **🔄 Advanced Stream Resumption:** Did you close your browser tab mid-stream? No problem. Re-open the chat, and the stream will pick up right where it left off.
- [x] **🤝 Multi-Session Sync:** Open the same chat in multiple windows or on different devices, and watch the messages stream in perfect sync across all of them.
- [x] **📝 Resizable Message Input:** Drag the top edge of the message input area to resize it for comfortable long-form writing - no height limits!
- [x] **🔐 Authentication:** A login system to keep your chats private.
- [x] **📜 Chat History:** All your conversations are saved and can be revisited anytime.
- [x] **🌳 Conversation Branching:** Fork conversations at any point to explore different discussion paths.
- [x] **🔄 Message Regeneration:** Regenerate AI responses with different models or parameters.
- [x] **📊 Comprehensive Logging:** Detailed logging with Serilog for better debugging and monitoring.
- [x] **SignalR Authentication Refactor:** Desktop/Android use cookies, iPhone uses Authorization header for SignalR. Dual-mode authentication and robust token management.
- [x] **Deployment Automation:** PowerShell deployment scripts for streamlined Azure provisioning and updates.
- [x] **Azure Key Vault Improvements:** Access rights and secret reading logic improved for reliability after key vault recreation.
- [x] **Docker Port Fix:** Backend Dockerfile defaults to port 80 for compatibility with Azure App Service and local development.
- [x] **CORS and Key Vault Security:** Backend reads only required secrets from Key Vault; CORS settings improved for security and SPA compatibility.
- [x] **Terraform Infrastructure:** Full Terraform scripts for Azure deployment, including modules for App Service, Key Vault, Static Web App, Storage Account, and more.
- [x] **Frontend Optimizations:** Bundle size reduced, Vite config improved, and ESLint rules updated for better code quality.
- [x] **General Bugfixes:** Error handling, logging, and chat event streaming improved across backend and frontend.

## 🛠️ Tech Stack & How It Was Built

This project was a collaboration between human and machine.

### Backend
![.NET](https://img.shields.io/badge/.NET-9.0-512BD4?style=for-the-badge&logo=dotnet)
![C#](https://img.shields.io/badge/C%23-12.0-239120?style=for-the-badge&logo=c-sharp&logoColor=white)
![SignalR](https://img.shields.io/badge/SignalR-realtime-F76423?style=for-the-badge)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Serilog](https://img.shields.io/badge/Serilog-logging-1E88E5?style=for-the-badge)

The backend was primarily built by me, with some expert consulting from **Sonnet 4**. The goal was a lean, powerful, and scalable foundation using ASP.NET Core 9. The application now uses **Azure OpenAI** services with credential-based authentication for secure, enterprise-grade AI integration, plus **Perplexity AI** for advanced search capabilities. Features comprehensive logging with **Serilog** for better debugging and monitoring.

### Frontend
![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![MUI](https://img.shields.io/badge/MUI-7.0-007FFF?style=for-the-badge&logo=mui&logoColor=white)

The UI was mostly crafted with the help of **Claude Code**. Originally built in JavaScript, it has since been converted to **TypeScript** for better type safety and developer experience. It's a clean, component-based React app built with Vite and styled with MUI.

---

## 🚀 Getting Started

### Prerequisites

*   [.NET SDK 9.0](https://dotnet.microsoft.com/download/dotnet/9.0)
*   On Ubuntu 22+: `apt update && apt install dotnet-sdk-9.0`
*   [Node.js v18+](https://nodejs.org/)
*   [pnpm](https://pnpm.io/) (recommended package manager)
*   [PowerShell](https://aka.ms/powershell) (required to run the Azure deployment script)
*   [Terraform](https://developer.hashicorp.com/terraform/downloads) (required for infrastructure automation)
*   [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (required for authentication and resource management)

### 1. Launching the Backend


The backend runs on port 80 by default (configured via Kestrel in appsettings.json):
- **Both Development and Production**: `http://localhost:80`

**Configuration:**

The backend now uses Azure OpenAI with credential-based authentication. All Azure resources and configuration are provisioned automatically using the included Terraform scripts and PowerShell deployment script.

**Quick Setup (Terraform Automated):**

1. **Clone the repository**
2. **Install prerequisites:**
   - [.NET SDK 9.0](https://dotnet.microsoft.com/download/dotnet/9.0)
   - [Node.js v18+](https://nodejs.org/)
   - [pnpm](https://pnpm.io/)
   - [PowerShell](https://aka.ms/powershell)
   - [Terraform](https://developer.hashicorp.com/terraform/downloads)
   - [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
3. **Configure your Azure credentials** (login with Azure CLI or set up a Service Principal)
4. **Run the deployment script:**
   - Open PowerShell and run:
     ```pwsh
     ./deploy-azure.ps1
     ```
   - This will provision all required Azure resources (App Service, Key Vault, Storage, Static Web App, etc.) and deploy the backend and frontend automatically.
5. **Update configuration:**
   - After deployment, Terraform will output the required endpoints and secrets. Update your `appsettings.json` and frontend `.env` file as needed.

**Example appsettings.json (current):**
```json
{
  "AzureOpenAI": {
    "Endpoint": "https://<your-openai-resource>.openai.azure.com/",
    "Models": ["gpt-4o-mini", "gpt-4o", "gpt-35-turbo"],
    "TitleModel": "gpt-4o-mini"
  },
  "Perplexity": {
    "ApiKey": "<your-perplexity-api-key>"
  },
  "Cors": {
    "AllowedOrigins": ["http://localhost:5173"]
  },
  "AllowedHosts": "*",
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://0.0.0.0:5173"
      }
    }
  }
}
```

> **Note:**
> - The `Cors:AllowedOrigins` setting controls which frontend origins are allowed to access the backend in production. For development, you can set it to `["http://localhost:5173"]` or add more domains as needed.

**Debug Mode:**
```bash
dotnet run --project backend/NotT3ChatBackend.csproj
```
> **Note:** This runs on `http://localhost:80`. The first time you run this, it will create a `databse.dat` SQLite file. When running in debug it will seed it with a default user:
> - **Username:** `admin@example.com`
> - **Password:** `admin`

**Production Mode:**
```bash
# Build for production
dotnet publish backend/NotT3ChatBackend.csproj -c Release -o publish

# Run the published app (uses port 80 by default via Kestrel configuration)
dotnet publish/NotT3ChatBackend.dll

# Or specify a custom port:
dotnet publish/NotT3ChatBackend.dll --urls http://0.0.0.0:5555
```

> A few warnings / notes: 
> 1. We use MemoryCache right now for synchronization; a future version will use Redis for multi-instance scale-out. 
> 2. CORS + CSRF: In development localhost:5173 is allowed; in production set `Cors:AllowedOrigins` accordingly. A double-submit cookie pattern (`XSRF-TOKEN` cookie + `X-CSRF-TOKEN` header) protects state-changing endpoints. 
> 3. Password requirements are intentionally minimal for demo purposes—tighten them for real deployments. 

### 2. Launching the Frontend

The frontend dev server runs on `http://localhost:5173` and will connect to the backend API on port 80.

```bash
# Navigate to the frontend directory
cd front-end

# Install dependencies using pnpm (recommended)
pnpm install

# Alternative: using npm if you prefer
# npm install

# Run the dev server (frontend will be available at http://localhost:5173)
VITE_API_URL=http://localhost:80 pnpm run dev

# Alternative with npm:
# VITE_API_URL=http://localhost:80 npm run dev
```
> You can also set `VITE_API_URL=http://localhost:80` in a `.env` file inside the `front-end` directory.

---

## 🔒 Security: CSRF protection

This app protects cookie-based REST calls using the double‑submit cookie pattern.

- What’s used
  - Cookie: `XSRF-TOKEN` (non‑HttpOnly, `SameSite=None`, `Secure`).
  - Header: `X-CSRF-TOKEN` must match the cookie for unsafe methods (POST/PUT/PATCH/DELETE).
  - Applies only to cookie‑authenticated requests (desktop/mobile browsers using the Identity cookie). iOS uses Bearer tokens and is not subject to cookie CSRF checks.

- Token issuance
  - Issued automatically on successful sign‑in and principal validation.
  - Middleware also ensures the cookie exists for authenticated users.
  - Cross‑site SPAs can request the token via `GET /csrf-token` (requires an authenticated cookie session). This returns `{ token }` and also sets the cookie if missing.

- Frontend behavior
  - Axios request interceptor adds `X-CSRF-TOKEN` for unsafe methods.
  - Same‑site: reads the `XSRF-TOKEN` cookie directly.
  - Cross‑site: falls back to `GET /csrf-token` and caches it, then attaches it to the header.

- SignalR
  - Desktop: `POST /signalr-token` is CSRF‑protected; on success an httpOnly `signalr-token` cookie is set and used for WebSocket auth.
  - iOS: uses Authorization Bearer tokens; no CSRF needed.

- CORS notes
  - Development allows `http://localhost:5173` with credentials.
  - Production origins must be listed in `Cors:AllowedOrigins`.
  - Ensure requests that rely on cookies include credentials; the backend allows custom headers including `X-CSRF-TOKEN`.

- Logout behavior
  - `/logout` clears `auth-token`, `signalr-token`, and `XSRF-TOKEN` cookies.

- Troubleshooting
  - 403 on `POST /signalr-token`: CSRF header missing or not matching; if cross‑site, call `GET /csrf-token` first and confirm cookies are `SameSite=None; Secure` and requests use `withCredentials`.
  - 401 responses: the client clears cached CSRF and redirects to login; reauthenticate to re‑issue tokens.

---


## 🗺️ Roadmap & Future Features

Here's a non-exhaustive list of what's planned when I get around to it:

- [ ] Attachments (files, images)
- [x] Better syntax highlighting for code blocks
- [ ] Even better syntax highlighting, with copy buttons
- [x] Branching conversations
- [x] Tools (Perplexity web search integration with streaming)
- [ ] Image generation
- [ ] Chat sharing via public links
- [x] Bring Your Own Key (BYOK) for API providers
- [x] Regenerate message (or regenerate with a different model)
- [x] Delete chats
- [ ] Delete individual messages?
- [x] Intelligent, automatic naming for new chats
- [x] Resizable message input area with drag-to-resize functionality
- [ ] Search through threads
- [x] Make it prettier?
- [x] Thinking models
- [x] Comprehensive logging with proper source context
- [x] SignalR authentication refactor (desktop/android cookies, iPhone header)
- [x] Deployment automation (PowerShell scripts)
- [x] Azure Key Vault improvements
- [x] Docker port fix
- [x] CORS and Key Vault security improvements
- [x] Terraform infrastructure for Azure
- [x] Frontend optimizations (bundle size, Vite, ESLint)
- [x] General bugfixes (error handling, logging, chat events)

---

## 💻 Developer's Corner

Some notes on the current state of the codebase for aspiring contributors.

### Backend Philosophy
The backend is currently in a single `Program.cs` file. This is an intentional experiment in anticipation of .NET 10's enhanced support for single-file applications (`dotnet run app.cs`). We are going to split it into a more traditional file structure for clarity soon. It's a WIP!

### Frontend Styling Rules
To maintain consistency and code quality with TypeScript, we follow these styling rules:

1.  **Component Styling:** Use components from **MUI** whenever possible.
2.  **Class Names:** For multiple conditional class names on an element, use the `light-classnames` library.
3.  **No Inline Styles:** All styling should be done via class names in dedicated `.css` files. **No inline `style` or `sx` props.**
4.  **No `!important`:** If you feel the need to use `!important`, take a break, have some water, and refactor.
5.  **TypeScript First:** All new components should be written in TypeScript for better type safety and developer experience.

### Technical To-Do List

- [x] Graceful error handling (e.g., 429 Too Many Requests, content filter blocks). (More or less done, can always be improved)
- [x] Streamline adding new models via environment variables instead of code changes.
- [ ] Add configuration to easily switch between db providers (In-Memory, SQLite, PostgreSQL, etc.).
- [ ] Consider segmenting larger UI components into smaller, more focused ones.
- [ ] Add an easy way to specify a default user account via environment variables for local development.
- [x] Logging with proper source context and structured logging via Serilog
- [ ] Add configuration to move to redis for distributed cache for better synchronization & locking for actively streaming chats.
- [x] Fix general chat events to always stream (delete, title, new)
- [x] Perplexity AI integration for web search and research capabilities
- [x] TypeScript conversion for better type safety on the frontend

---


---



## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. All contributions are more than welcome! Feel free to fork the repo, create a feature branch, and open a pull request.

## 📜 License

This project is licensed under the [MIT License](LICENSE.md).
