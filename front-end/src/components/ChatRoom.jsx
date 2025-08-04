import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  AppBar,
  Toolbar,
  Chip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Send as SendIcon,
  ExitToApp as LogoutIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSignalR } from '../contexts/SignalRContext';
import { useAuth } from '../contexts/AuthContext';
import { useChats } from '../contexts/ChatContext';
import { chatApi } from '../services/chatApi';
import ChatMessage from './ChatMessage';
import ChatSidebar from './ChatSidebar';
import ModelSelector from './ModelSelector';
import './ChatRoom.css';

const ChatRoom = () => {
  const [messageInput, setMessageInput] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const messagesEndRef = useRef(null);
  const { logout } = useAuth();
  const { addNewChat, chats, hasLoaded } = useChats();
  const { chatId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isNarrowDesktop = useMediaQuery('(max-width: 1200px)');

  // Always use permanent sidebar, but start collapsed on narrow screens
  const shouldStartCollapsed = isNarrowDesktop;

  const activeChat = useMemo(() => chats.find(c => c.id == chatId), [chatId, chats]);

  // Use global SignalR connection
  const { 
    messages, 
    sendMessage, 
    regenerateMessage,
    isConnected, 
    isConnecting,
    currentAssistantMessage, 
    chooseChat,
    reconnect 
  } = useSignalR();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, messages, currentAssistantMessage]);

  // Choose chat when chatId changes
  useEffect(() => {
    chooseChat(chatId).then(() => setIsCreatingChat(false));
  }, [chatId, chooseChat]);

  useEffect(() => {
    if (hasLoaded && !activeChat) navigate('/chat');
  }, [hasLoaded, activeChat, navigate]);

  // Update selected model to match the last message's model
  useEffect(() => {
    if (messages.length > 0) {
      // Find the last assistant message with a model
      const lastAssistantMessage = [...messages]
        .reverse()
        .find(msg => msg.type === 'assistant' && msg.chatModel);
      
      if (lastAssistantMessage) {
        setSelectedModel(lastAssistantMessage.chatModel);
      }
    }
  }, [messages]);

  // Effect to send pending message when SignalR connection is established
  useEffect(() => {
    if (isConnected && pendingMessage && !isCreatingChat) {
      const messageToSend = pendingMessage;
      setPendingMessage('');
      setMessageInput('');
      sendMessage(selectedModel, messageToSend);
    }
  }, [isConnected, pendingMessage, isCreatingChat, sendMessage, selectedModel]);

  const forkChat = useCallback(async (messageId) => {
    try {
      const newChat = await chatApi.forkChat(chatId, messageId);
      addNewChat(newChat);
      navigate(`/chat/${newChat.id}`);
    } catch (error) {
      console.error('Error forking chat:', error);
    }
  }, [addNewChat, navigate, chatId]); 

  const createNewChatAndSend = useCallback(
    async (message) => {
      setIsCreatingChat(true);
      try {
        const newChat = await chatApi.createNewChat();
        // Add to chat list
        addNewChat(newChat);
        // Set the pending message to send after connection
        setPendingMessage(message);
        // Navigate to the new chat
        navigate(`/chat/${newChat.id}`);
        // Clear input and creating state
        setMessageInput('');
      } catch (error) {
        console.error('Error creating new chat:', error);
        setIsCreatingChat(false);
        setPendingMessage('');
      }
    },
    [addNewChat, navigate]
  );

  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      if (!messageInput.trim()) return;

      if (!chatId) {
        // No chat exists, create a new one
        await createNewChatAndSend(messageInput.trim());
      } else {
        // Send message to existing chat
        await sendMessage(selectedModel, messageInput.trim());
        setMessageInput('');
      }
    },
    [chatId, sendMessage, selectedModel, messageInput, createNewChatAndSend]
  );

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handleChatSelect = useCallback(
    (selectedChatId) => {
      if (selectedChatId) {
        navigate(`/chat/${selectedChatId}`);
      } else {
        navigate('/chat');
      }
    },
    [navigate]
  );

  const handleSidebarResize = useCallback((width) => {
    setSidebarWidth(width);
  }, []);

  return (
    <div className="chat-room">
      <Box className="chat-container">
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" className="app-bar-title">
              {chatId && activeChat ? activeChat.title : 'New Chat'}
            </Typography>
            <Chip
              label={
                isConnecting 
                  ? 'Connecting...' 
                  : isConnected 
                    ? 'Connected' 
                    : 'Disconnected'
              }
              color={
                isConnecting 
                  ? 'warning' 
                  : isConnected 
                    ? 'success' 
                    : 'error'
              }
              variant="outlined"
              className="connection-chip"
            />
            {!isConnected && !isConnecting && (
              <Button
                color="inherit"
                onClick={reconnect}
                startIcon={<RefreshIcon />}
                size="small"
                variant="outlined"
                sx={{ ml: 1 }}
              >
                Reconnect
              </Button>
            )}
            <Button
              color="inherit"
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
            >
              Logout
            </Button>
          </Toolbar>
        </AppBar>

        <Box 
          className="main-layout" 
          sx={{ 
            display: 'flex',
            height: 'calc(100vh - 64px)', // Full height minus AppBar
            marginTop: 0,
            paddingTop: 0,
          }}
        >
          {/* Chat Sidebar */}
          <ChatSidebar
            onChatSelect={handleChatSelect}
            currentChatId={chatId}
            onSidebarResize={handleSidebarResize}
            shouldStartCollapsed={shouldStartCollapsed}
          />
          
          <Box 
            className="main-content"
            sx={{
              flex: 1,
              minWidth: 0, // Allows flex item to shrink below its content size
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Container 
              maxWidth={false}
              className="chat-container-inner"
              sx={{
                maxWidth: 'none',
                width: '100%',
                padding: '16px',
              }}
            >
            <Paper elevation={3} className="chat-paper">
              {/* Messages Area */}
              <Box className="messages-area">
                {messages.length === 0 ? (
                  <Box className="empty-state">
                    <Typography variant="h6">
                      {isCreatingChat
                        ? 'Connecting to chat...'
                        : !isConnected && chatId
                          ? 'Connecting to chat room...'
                          : chatId
                            ? 'This chat is empty.'
                            : 'Start conversation!'}
                    </Typography>
                  </Box>
                ) : (
                  <Box className="messages-container">
                    {messages.map((message, index) => (
                      <ChatMessage 
                        key={message.id} 
                        message={message} 
                        selectedModel={selectedModel}
                        onSetSelectedModel={setSelectedModel}
                        onRegenerateMessage={regenerateMessage}
                        onForkChat={forkChat}
                        isLastMessage={index === messages.length - 1}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </Box>
                )}
              </Box>

              {/* Input Area */}
              <Box className="input-area">
                {/* Resize Handle */}
                <Box 
                  className="resize-handle"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const inputArea = e.target.parentElement;
                    const startHeight = inputArea.offsetHeight;
                    
                    const handleMouseMove = (moveEvent) => {
                      const deltaY = startY - moveEvent.clientY;
                      const newHeight = Math.max(120, startHeight + deltaY);
                      inputArea.style.height = `${newHeight}px`;
                    };
                    
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    
                    // Add haptic feedback on mobile (if available)
                    if (navigator.vibrate) {
                      navigator.vibrate(10); // Very short vibration
                    }
                    
                    const startY = e.touches[0].clientY;
                    const inputArea = e.target.parentElement;
                    const startHeight = inputArea.offsetHeight;
                    
                    const handleTouchMove = (moveEvent) => {
                      // Prevent default to avoid scrolling
                      moveEvent.preventDefault();
                      
                      const deltaY = startY - moveEvent.touches[0].clientY;
                      const newHeight = Math.max(120, Math.min(400, startHeight + deltaY)); // Add max height for mobile
                      inputArea.style.height = `${newHeight}px`;
                    };
                    
                    const handleTouchEnd = () => {
                      document.removeEventListener('touchmove', handleTouchMove);
                      document.removeEventListener('touchend', handleTouchEnd);
                    };
                    
                    document.addEventListener('touchmove', handleTouchMove, { passive: false });
                    document.addEventListener('touchend', handleTouchEnd, { passive: false });
                  }}
                />
                
                {/* Model Selector Row */}
                <Box className="model-selector-row">
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    className="model-label"
                  >
                    Model:
                  </Typography>
                  <ModelSelector
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    disabled={
                      (chatId && !isConnected) ||
                      !!currentAssistantMessage ||
                      isCreatingChat ||
                      isConnecting
                    }
                  />
                </Box>

                {/* Message Input Row */}
                <Box
                  component="form"
                  onSubmit={handleSendMessage}
                  className="message-input-row"
                >
                  <TextField
                    fullWidth
                    multiline
                    minRows={1}
                    variant="outlined"
                    className="message-input"
                    placeholder={
                      isCreatingChat
                        ? 'Connecting and sending message...'
                        : !isConnected && chatId
                          ? 'Connecting to chat room...'
                          : 'Type your message... (Markdown supported)'
                    }
                    value={isCreatingChat || messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    disabled={
                      (chatId && !isConnected) ||
                      !!currentAssistantMessage ||
                      isCreatingChat ||
                      isConnecting
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    slotProps={{
                      input: {
                        style: { 
                          height: '100%',
                          alignItems: 'stretch'
                        }
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    className="send-button"
                    disabled={
                      (chatId && !isConnected) ||
                      !messageInput.trim() ||
                      !!currentAssistantMessage ||
                      isCreatingChat ||
                      !!pendingMessage
                    }
                  >
                    <SendIcon />
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Container>
        </Box>
      </Box>
    </Box>
  </div>
  );
};

export default ChatRoom;
