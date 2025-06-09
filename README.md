# NotT3Chat: The C# Answer to the T3 Stack

 <img src="stuff/logo.png" width="175" />


Welcome to **NotT3Chat**, a fully-featured, real-time chat application built for the [cloneathon.t3.chat](https://cloneathon.t3.chat). This project serves as a testament to the raw power and elegance of C# and ASP.NET Core, proving that you don't need TypeScript to build amazing, modern web applications. (Sorry, Theo.)

> Too much bullshit just take me to [Getting Started](#-getting-started).

### Check out the demo!

![](stuff/example.gif)

---

## 🤔 Why?

Why build another chat app? Two reasons:

1.  To participate in the T3 Clone-a-thon and have some fun.
2.  To lovingly poke at the T3 stack and demonstrate that a robust, type-safe, and high-performance application can be built with the glorious combination of **C# on the backend** and plain ol' JavaScript on the front. It's a love letter to backend developers who appreciate strongly-typed languages that *aren't* a superset of JavaScript.

## ✨ Core Features

This is far from just a "hello world" chat. We've packed in some serious features:

*   **🤖 Multi-LLM Support:** Seamlessly switch between different models and providers (currently OpenAI and Google, but the rest are just one line of code away).
*   **⚡ Blazing-Fast Real-Time Chat:** Built with the magic of **[SignalR](https://dotnet.microsoft.com/apps/aspnet/signalr)**, messages stream in real-time.
*   **🔄 Advanced Stream Resumption:** Did you close your browser tab mid-stream? No problem. Re-open the chat, and the stream will pick up right where it left off.
*   **🤝 Multi-Session Sync:** Open the same chat in multiple windows or on different devices, and watch the messages stream in perfect sync across all of them.
*   **🔐 Authentication:** A login system to keep your chats private.
*   **📜 Chat History:** All your conversations are saved and can be revisited anytime.

## 🛠️ Tech Stack & How It Was Built

This project was a collaboration between human and machine.

### Backend
![.NET](https://img.shields.io/badge/.NET-8.0-512BD4?style=for-the-badge&logo=dotnet)
![C#](https://img.shields.io/badge/C%23-12.0-239120?style=for-the-badge&logo=c-sharp&logoColor=white)
![SignalR](https://img.shields.io/badge/SignalR-realtime-F76423?style=for-the-badge)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

The backend was primarily built by me, with some expert consulting from **Sonnet 4**. The goal was a lean, powerful, and scalable foundation using ASP.NET Core 8. Hoping to move to ASP.NET Core 10 soon. 

### Frontend
![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![MUI](https://img.shields.io/badge/MUI-5-007FFF?style=for-the-badge&logo=mui&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

The UI was mostly crafted with the help of **Claude Code**. It was a surprisingly smooth experience, resulting in a clean, component-based React app built with Vite and styled with MUI.

---

## 🚀 Getting Started

### Prerequisites

*   [.NET SDK 8.0](https://dotnet.microsoft.com/download/dotnet/8.0)
    *   On Ubuntu 22+: `apt update && apt install dotnet-sdk-8.0`
*   [Node.js v18+](https://nodejs.org/)

### 1. Launching the Backend

The backend runs on port `http://localhost:5128` by default in debug mode.

**Debug Mode:**
```bash
# From the root directory
export GOOGLE_API_KEY=...
export OAI_API_KEY=...
dotnet run --project backend/NotT3ChatBackend.csproj
```
> **Note:** The first time you run this, it will create a `databse.dat` SQLite file. When running in debug it will seed it with a default user:
> - **Username:** `admin@example.com`
> - **Password:** `admin`

**Production Mode:**
```bash
# Build for production
dotnet publish backend/NotT3ChatBackend.csproj -c Release -o publish

# Run the published app (example on port 5555)
export GOOGLE_API_KEY=...
export OAI_API_KEY=...
dotnet publish/NotT3ChatBackend.dll --urls http://0.0.0.0:5555
```

### 2. Launching the Frontend

The frontend dev server will connect to the backend API.

```bash
# Navigate to the frontend directory
cd front-end

# Install dependencies
npm install

# Run the dev server
# Make sure this URL matches your backend's URL
VITE_API_URL=http://localhost:5128 npm run dev
```
> You can also set `VITE_API_URL` in a `.env` file inside the `front-end` directory.

---

## 🗺️ Roadmap & Future Features

Here's a non-exhaustive list of what's planned when I get around to it:

- [ ] Attachments (files, images)
- [ ] Better syntax highlighting for code blocks
- [ ] Branching conversations
- [ ] Tools (like web search)
- [ ] Image generation
- [ ] Chat sharing via public links
- [ ] Bring Your Own Key (BYOK) for API providers
- [ ] Regenerate message (or regenerate with a different model)
- [ ] Delete chats and individual messages
- [ ] Intelligent, automatic naming for new chats
- [ ] Search through threads
- [ ] Make it prettier?

---

## 💻 Developer's Corner

Some notes on the current state of the codebase for aspiring contributors.

### Backend Philosophy
The backend is currently in a single `Program.cs` file. This is an intentional experiment in anticipation of .NET 10's enhanced support for single-file applications (`dotnet run app.cs`). We are considering splitting it into a more traditional file structure for clarity as it grows. It's a WIP!

### Frontend Styling Rules
To maintain sanity without TypeScript, we follow a few simple styling rules:

1.  **Component Styling:** Use components from **MUI** whenever possible.
2.  **Class Names:** For multiple conditional class names on an element, use the `light-classnames` library.
3.  **No Inline Styles:** All styling should be done via class names in dedicated `.css` files. **No inline `style` or `sx` props.**
4.  **No `!important`:** If you feel the need to use `!important`, take a break, have some water, and refactor.

### Technical To-Do List

- [ ] Graceful error handling (e.g., 429 Too Many Requests, content filter blocks).
- [ ] Better documentation for required environment variables (`GOOGLE_API_KEY`, `OAI_API_KEY`).
- [ ] Streamline adding new models via environment variables instead of code changes.
- [ ] Abstract the database context to easily switch between providers (In-Memory, SQLite, PostgreSQL, etc.).
- [ ] Consider segmenting larger UI components into smaller, more focused ones.
- [ ] Add an easy way to specify a default user account via environment variables for local development.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. All contributions are more than welcome! Feel free to fork the repo, create a feature branch, and open a pull request.

## 📜 License

This project is licensed under the [MIT License](LICENSE.md).