import { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import lcn from 'light-classnames';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import { useChats } from '../contexts/ChatContext';
import { formatDate } from '../extra/utils';
import './ChatSidebar.css';

const ChatSidebar = ({ onChatSelect, currentChatId }) => {
  const { chats, loading, error, hasLoaded, loadChats } = useChats();

  // Load chats once when component mounts if not already loaded
  useEffect(() => {
    if (!hasLoaded) {
      loadChats();
    }
  }, [hasLoaded, loadChats]);

  const handleNewChat = useCallback(() => {
    onChatSelect(null); // null indicates new chat
  }, [onChatSelect]);

  const handleChatClick = useCallback(
    (chatId) => {
      onChatSelect(chatId);
    },
    [onChatSelect]
  );

  const drawerContent = (
    <div className="chat-sidebar">
      <Box className="drawer-content">
        {/* Header */}
        <Box className="sidebar-header">
          <Typography variant="h6" component="div">
            Chats
          </Typography>
          <Box className="header-actions">
            <IconButton onClick={loadChats} size="small" title="Refresh chats">
              <ChatIcon />
            </IconButton>
          </Box>
        </Box>

        {/* New Chat Button */}
        <Box className="new-chat-section">
          <ListItemButton onClick={handleNewChat} className="new-chat-button">
            <AddIcon className="new-chat-icon" />
            <ListItemText primary="New Chat" />
          </ListItemButton>
        </Box>

        <Divider />

        {/* Chat List */}
        <Box className="chat-list-container">
          {loading ? (
            <Box className="loading-container">
              <CircularProgress size={24} />
            </Box>
          ) : error ? (
            <Box className="error-container">
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : chats.length === 0 ? (
            <Box className="empty-state">
              <ChatIcon className="empty-icon" />
              <Typography variant="body2">No chats yet</Typography>
              <Typography variant="caption">
                Start a new conversation!
              </Typography>
            </Box>
          ) : (
            <List className="chat-list">
              {chats.map((chat) => (
                <ListItem key={chat.id} disablePadding className="chat-item">
                  <ListItemButton
                    onClick={() => handleChatClick(chat.id)}
                    selected={currentChatId === chat.id}
                    className={lcn ('chat-button', {
                      selected: currentChatId === chat.id,
                    })}
                  >
                    <Box className="chat-content">
                      <Typography
                        variant="body2"
                        className={lcn ('chat-title', {
                          selected: currentChatId === chat.id,
                        })}
                      >
                        Chat {chat.id.substring(0, 8)}...
                      </Typography>
                      <Typography variant="caption" className="chat-date">
                        {formatDate(chat.createdAt)}
                      </Typography>
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Box>
    </div>
  );

  return (
    <Drawer
      variant="permanent"
      anchor="left"
      sx={{
        '& .MuiDrawer-paper': {
          boxSizing: 'border-box',
          width: 300,
          top: '64px',
          height: 'calc(100vh - 64px)',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

ChatSidebar.propTypes = {
  onChatSelect: PropTypes.func.isRequired,
  currentChatId: PropTypes.string,
};

export default ChatSidebar;
