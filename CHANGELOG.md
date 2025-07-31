# Changelog

All notable changes to NotT3Chat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Resizable Message Input Area**: Added a resizable handle at the top edge of the message input area
  - Users can now drag the top border to resize the input container vertically
  - Visual feedback with blue highlight when hovering over the resize handle
  - Unlimited maximum height - can resize to take up the entire screen
  - Minimum height constraint of 120px to maintain usability

### Changed
- **Enhanced Message Input UX**: 
  - Removed `maxRows` limitation from textarea for better flexibility
  - Input area now expands to fill the available resized space
  - Improved responsive behavior for long message composition

### Technical Details
- Added `resize-handle` component with mouse drag functionality
- Updated CSS for proper flex layout and height management
- Enhanced textarea styling to fill available container space
- Added visual hover states for better user feedback

---

## Previous Releases

### Core Features (Initial Release)
- 🤖 Multi-LLM Support (OpenAI, Google, Anthropic, etc.)
- ⚡ Real-time chat with SignalR
- 🔄 Advanced stream resumption
- 🤝 Multi-session synchronization
- 🔐 User authentication
- 📜 Chat history and management
- 🔀 Conversation branching
- 🔄 Message regeneration with different models
- 🗑️ Chat deletion
- 🏷️ Intelligent automatic chat naming
