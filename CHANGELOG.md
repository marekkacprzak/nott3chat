# Changelog

All notable changes to NotT3Chat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased] - 2025-08

### Changed (AzureAI branch)

- **SignalR Authentication Refactor:**
  - Desktop/Android now use cookies, iPhone uses Authorization header for SignalR. Fixes cross-origin cookie issues for mobile users.
  - Frontend and backend updated to support dual-mode authentication (header/cookie) and robust token management.
- **Deployment Automation:**
  - New PowerShell deployment scripts (`deploy-azure.ps1`) for streamlined Azure provisioning and updates.
- **Azure Key Vault Improvements:**
  - Access rights and secret reading logic improved for reliability after key vault recreation.
- **Docker Port Fix:**
  - Backend Dockerfile now defaults to port 80 for compatibility with Azure App Service and local development.
- **CORS and Key Vault Security:**
  - Backend now reads only required secrets from Key Vault; CORS settings improved for security and SPA compatibility.
- **Terraform Infrastructure:**
  - Major addition: full Terraform scripts for Azure deployment, including modules for App Service, Key Vault, Static Web App, Storage Account, and more.
- **Frontend Optimizations:**
  - Bundle size reduced, Vite config improved, and ESLint rules updated for better code quality.
- **General Bugfixes:**
  - Error handling, logging, and chat event streaming improved across backend and frontend.

### Added
- **🔍 Perplexity AI Integration**: Added comprehensive search capabilities with streaming support
  - Stream-based integration for real-time search results
  - Support for both regular and streaming API modes
  - Proper SSE (Server-Sent Events) handling
  - Integrated Perplexity API for web search and research
  - Support for search recency filters and comprehensive search mode
  - Real-time streaming of search results with sources
  - Demo mode with fallback when no API key is configured
  - Cost tracking and usage monitoring

- **📊 Advanced Logging System**: Implemented comprehensive logging with Serilog
  - Source context logging to identify which component generated each log entry
  - Structured logging with proper log levels and filtering
  - Custom output templates with timestamps and source information
  - Entity Framework logging suppression for cleaner output
  - CORS request logging with proper middleware integration

- **🎯 Enhanced Authentication & Authorization**:
  - Dual authentication schemes: Bearer tokens + Application cookies
  - JWT token generation for SignalR connections
  - Custom SignalR authentication with query string token support
  - Comprehensive authorization on all protected endpoints
  - Proper error handling for authentication failures

- **🔄 Frontend TypeScript Migration**: Converted entire frontend from JavaScript to TypeScript
  - Complete type safety for all React components
  - Type definitions for API responses and SignalR events
  - Enhanced developer experience with IntelliSense
  - Improved code maintainability and error detection

- **📱 Mobile Console Logger**: Advanced debugging solution for mobile devices
  - Real-time console output overlay for iPhone debugging
  - Support for all console methods (log, error, warn, info, debug, table, trace)
  - Mobile-optimized interface with touch-friendly controls
  - Automatic memory management with 100-entry limit
  - iOS safe area support and momentum scrolling
  - Dedicated `/logging` page for comprehensive log viewing

- **🛠️ Package Manager Migration**: Switched from npm to pnpm
  - Faster dependency installation and better disk space usage
  - Lock file migration for consistent dependency resolution
  - Updated all documentation and scripts

- **🔧 Backend Architecture Improvements**:
  - Upgraded to .NET 9.0 from .NET 8.0
  - Enhanced error handling and exception management
  - Improved service registration and dependency injection
  - Better configuration management with environment variables

### Changed
- **Enhanced Message Input UX**: 
  - Resizable message input area with drag-to-resize functionality
  - Removed `maxRows` limitation from textarea for better flexibility
  - Input area now expands to fill the available resized space
  - Visual feedback with blue highlight when hovering over resize handle
  - Unlimited maximum height capability

- **🎨 UI/UX Improvements**:
  - Updated Material-UI to version 7.0
  - Enhanced React to version 19 with latest features
  - Improved Vite configuration for better development experience
  - Better responsive design for mobile and desktop

- **⚙️ Configuration Management**:
  - Updated port configuration (backend runs on port 80, frontend on 5173)
  - Enhanced environment variable support
  - Better Azure OpenAI configuration with credential-based auth
  - Improved development vs production configuration separation

### Fixed
- **Authentication Flow**: Resolved token validation and SignalR authentication issues
- **CORS Configuration**: Proper CORS setup with credential support and preflight caching
- **Logging**: Fixed source context issues and improved log readability
- **Build Process**: Resolved TypeScript compilation errors and build warnings
- **Mobile Compatibility**: Fixed iOS Safari issues and touch interactions

### Technical Details
- **Backend Stack**: ASP.NET Core 9.0, SignalR, Serilog, SQLite, Azure OpenAI SDK
- **Frontend Stack**: React 19, TypeScript 5.9, Vite 6.0, Material-UI 7.0, pnpm
- **New Services**: PerplexityService, CorsLoggingMiddleware, StreamingService enhancements
- **Configuration**: Enhanced appsettings with Serilog configuration and structured logging
- **Authentication**: Multi-scheme authentication with JWT and cookie support

---

## [Previous Releases] - 2025-07

### Core Features (Initial Release)
- 🤖 **Multi-LLM Support**: OpenAI, Azure OpenAI integration with credential-based authentication
- ⚡ **Real-time Chat**: SignalR implementation with WebSocket fallback
- 🔄 **Advanced Stream Resumption**: Resume interrupted conversations seamlessly
- 🤝 **Multi-session Synchronization**: Sync across multiple browser tabs and devices
- 🔐 **User Authentication**: ASP.NET Core Identity with role-based access control
- 📜 **Chat History**: Persistent conversation storage with SQLite database
- 🔀 **Conversation Branching**: Fork conversations at any message point
- 🔄 **Message Regeneration**: Regenerate responses with different models
- 🗑️ **Chat Management**: Delete chats with proper cleanup
- 🏷️ **Intelligent Naming**: Automatic chat title generation using AI
- 🎨 **Modern UI**: Material-UI components with dark/light theme support
- 📱 **Responsive Design**: Mobile-first approach with touch-friendly interface

### Architecture Highlights
- **Single-File Backend**: Experimental approach using single Program.cs file
- **Component-Based Frontend**: Clean React component architecture
- **Real-time Synchronization**: SignalR hubs for instant updates
- **Type Safety**: Strong typing throughout C# backend
- **Modern Tooling**: Vite for fast development and building
