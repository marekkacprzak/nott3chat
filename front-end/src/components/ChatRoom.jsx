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
} from '@mui/material';
import {
  Send as SendIcon,
  ExitToApp as LogoutIcon,
} from '@mui/icons-material';
import { useSignalR } from '../hooks/useSignalR';
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
  const messagesEndRef = useRef(null);
  const { logout } = useAuth();
  const { addNewChat } = useChats();
  const { chatId } = useParams();
  const navigate = useNavigate();

  // Only connect to SignalR if we have a chatId
  const { messages, sendMessage, regenerateMessage, isConnected, currentAssistantMessage } =
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

  return (
    <div className="chat-room">
      <Box className="chat-container">
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" className="app-bar-title">
              {chatId ? `Chat ${chatId.substring(0, 8)}...` : 'New Chat'}
            </Typography>
            {chatId && (
              <Chip
                label={isConnected ? 'Connected' : 'Disconnected'}
                color={isConnected ? 'success' : 'error'}
                variant="outlined"
                className="connection-chip"
              />
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

        <Box className="main-content sidebar-open">
          <Container maxWidth="md" className="chat-container-inner">
            <Paper elevation={3} className="chat-paper">
              {/* Messages Area */}
              <Box className="messages-area">
                {messages.length === 0 ? (
                  <Box className="empty-state">
                    <Typography variant="h6">
                      {pendingMessage
                        ? 'Connecting to chat...'
                        : chatId
                          ? 'This chat is empty. Start the conversation!'
                          : 'Start a new conversation with the assistant!'}
                    </Typography>
                  </Box>
                ) : (
                  <Box className="messages-container">
                    {messages.map((message) => (
                      <ChatMessage 
                        key={message.id} 
                        message={message} 
                        selectedModel={selectedModel}
                        onSetSelectedModel={setSelectedModel}
                        onRegenerateMessage={regenerateMessage}
                        onForkChat={forkChat}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </Box>
                )}
              </Box>

              {/* Input Area */}
              <Box className="input-area">
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
                      !!pendingMessage
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
                    maxRows={4}
                    variant="outlined"
                    className="message-input"
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

        {/* Chat Sidebar */}
        <ChatSidebar
          onChatSelect={handleChatSelect}
          currentChatId={chatId}
        />
      </Box>
    </div>
  );
};

export default ChatRoom;
