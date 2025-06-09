import { useState, useEffect, useRef, useCallback } from 'react';
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
  IconButton,
} from '@mui/material';
import {
  Send as SendIcon,
  ExitToApp as LogoutIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useSignalR } from '../hooks/useSignalR';
import { useAuth } from '../contexts/AuthContext';
import { useChats } from '../contexts/ChatContext';
import { chatApi } from '../services/chatApi';
import ChatMessage from './ChatMessage';
import ChatSidebar from './ChatSidebar';
import ModelSelector from './ModelSelector';

const ChatRoom = () => {
  const [messageInput, setMessageInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const messagesEndRef = useRef(null);
  const { logout } = useAuth();
  const { addNewChat } = useChats();
  const { chatId } = useParams();
  const navigate = useNavigate();

  // Only connect to SignalR if we have a chatId
  const { messages, sendMessage, isConnected, currentAssistantMessage } =
    useSignalR(chatId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, messages, currentAssistantMessage]);

  // Effect to send pending message when SignalR connection is established
  useEffect(() => {
    if (isConnected && pendingMessage && !isCreatingChat) {
      const messageToSend = pendingMessage;
      setPendingMessage('');
      setMessageInput('');
      sendMessage(selectedModel, messageToSend);
    }
  }, [isConnected, pendingMessage, isCreatingChat, sendMessage, selectedModel]);

  const createNewChatAndSend = useCallback(
    async (message) => {
      setIsCreatingChat(true);
      try {
        const { id: newChatId, createdAt } = await chatApi.createNewChat();
        // Add to chat list
        addNewChat({
          id: newChatId,
          createdAt: createdAt,
        });
        // Set the pending message to send after connection
        setPendingMessage(message);
        // Navigate to the new chat
        navigate(`/chat/${newChatId}`);
        // Clear input and creating state
        setMessageInput('');
        setIsCreatingChat(false);
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

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [sidebarOpen]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {chatId ? `Chat ${chatId.substring(0, 8)}...` : 'New Chat'}
          </Typography>
          {chatId && (
            <Chip
              label={isConnected ? 'Connected' : 'Disconnected'}
              color={isConnected ? 'success' : 'error'}
              variant="outlined"
              sx={{ mr: 2, color: 'white', borderColor: 'white' }}
            />
          )}
          <IconButton color="inherit" onClick={toggleSidebar} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
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
        sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          ml: sidebarOpen ? { md: '300px' } : 0,
          transition: 'margin-left 0.3s ease',
          minHeight: 0, // Allow flex child to shrink below content size
          overflow: 'hidden',
        }}
      >
        <Container
          maxWidth="md"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            py: 2,
            maxWidth: '800px',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <Paper
            elevation={3}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              height: '100%',
            }}
          >
            {/* Messages Area */}
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                bgcolor: '#f8f9fa',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0, // Important for flex child to be scrollable
              }}
            >
              {messages.length === 0 ? (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'text.secondary',
                  }}
                >
                  <Typography variant="h6">
                    {pendingMessage
                      ? 'Connecting to chat...'
                      : chatId
                        ? 'This chat is empty. Start the conversation!'
                        : 'Start a new conversation with the assistant!'}
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    flex: 1,
                    py: 2,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  <div ref={messagesEndRef} />
                </Box>
              )}
            </Box>

            {/* Input Area */}
            <Box
              sx={{
                p: 2,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'white',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              {/* Model Selector Row */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  pb: 0.5,
                  borderBottom: 1,
                  borderColor: 'grey.200',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ minWidth: 'auto' }}
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
                    !!pendingMessage
                  }
                />
              </Box>

              {/* Message Input Row */}
              <Box
                component="form"
                onSubmit={handleSendMessage}
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-end',
                }}
              >
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  variant="outlined"
                  placeholder={
                    pendingMessage
                      ? 'Connecting and sending message...'
                      : 'Type your message... (Markdown supported)'
                  }
                  value={pendingMessage || messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={
                    (chatId && !isConnected) ||
                    !!currentAssistantMessage ||
                    isCreatingChat ||
                    !!pendingMessage
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={
                    (chatId && !isConnected) ||
                    !messageInput.trim() ||
                    !!currentAssistantMessage ||
                    isCreatingChat ||
                    !!pendingMessage
                  }
                  sx={{
                    minWidth: 'auto',
                    px: 3,
                    py: 1.5,
                    borderRadius: 2,
                    height: 'fit-content',
                  }}
                >
                  <SendIcon />
                </Button>
              </Box>
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        onChatSelect={handleChatSelect}
        currentChatId={chatId}
      />
    </Box>
  );
};

export default ChatRoom;
