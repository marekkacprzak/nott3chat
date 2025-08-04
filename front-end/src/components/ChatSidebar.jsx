import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import lcn from 'light-classnames';
import {
  Drawer,
  SwipeableDrawer,
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
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Chat as ChatIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useChats } from '../contexts/ChatContext';
import { formatDate } from '../extra/utils';
import './ChatSidebar.css';

const DRAWER_WIDTH = 300;
const COLLAPSED_WIDTH = 60;
const MIN_WIDTH = 150; // Minimum width before collapsing

const ChatSidebar = ({ onChatSelect, currentChatId, onSidebarResize, shouldStartCollapsed }) => {
  const { chats, loading, error, hasLoaded, loadChats, deleteChat } = useChats();
  const [sidebarWidth, setSidebarWidth] = useState(DRAWER_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(shouldStartCollapsed);
  const theme = useTheme();

  // Update collapsed state when shouldStartCollapsed changes
  useEffect(() => {
    setIsCollapsed(shouldStartCollapsed);
    const newWidth = shouldStartCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;
    setSidebarWidth(newWidth);
    if (onSidebarResize) {
      onSidebarResize(newWidth);
    }
  }, [shouldStartCollapsed, onSidebarResize]);

  // Ensure collapsed state is synchronized with sidebar width
  useEffect(() => {
    const shouldBeCollapsed = sidebarWidth <= MIN_WIDTH;
    if (shouldBeCollapsed !== isCollapsed) {
      setIsCollapsed(shouldBeCollapsed);
    }
  }, [sidebarWidth, isCollapsed]);

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

  const handleDeleteChat = useCallback(
    async (event, chatId) => {
      event.stopPropagation(); // Prevent triggering chat selection
      const success = await deleteChat(chatId);
      if (success && currentChatId === chatId) {
        // If we deleted the currently selected chat, navigate to new chat
        onChatSelect(null);
      }
    },
    [deleteChat, currentChatId, onChatSelect]
  );

  // Handle resize functionality
  const handleResizeStart = useCallback((event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = isCollapsed ? COLLAPSED_WIDTH : sidebarWidth;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(50, Math.min(500, startWidth + deltaX));
      
      // Always update width first, then determine collapsed state
      setSidebarWidth(newWidth);
      
      // Check if should collapse or expand based on the new width
      if (newWidth < MIN_WIDTH) {
        // Should be collapsed
        if (!isCollapsed) {
          setIsCollapsed(true);
        }
        // Force width to collapsed width when below minimum
        setSidebarWidth(COLLAPSED_WIDTH);
        if (onSidebarResize) {
          onSidebarResize(COLLAPSED_WIDTH);
        }
      } else {
        // Should be expanded
        if (isCollapsed) {
          setIsCollapsed(false);
        }
        if (onSidebarResize) {
          onSidebarResize(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth, isCollapsed, onSidebarResize]);

  const toggleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    
    if (newCollapsed) {
      // When collapsing, always use collapsed width
      setSidebarWidth(COLLAPSED_WIDTH);
      if (onSidebarResize) {
        onSidebarResize(COLLAPSED_WIDTH);
      }
    } else {
      // When expanding, use default drawer width or current width if it's larger
      const newWidth = sidebarWidth < MIN_WIDTH ? DRAWER_WIDTH : Math.max(DRAWER_WIDTH, sidebarWidth);
      setSidebarWidth(newWidth);
      if (onSidebarResize) {
        onSidebarResize(newWidth);
      }
    }
  }, [isCollapsed, sidebarWidth, onSidebarResize]);

  const drawerContent = (
    <div className="chat-sidebar">
      <Box 
        className="drawer-content" 
        sx={{ 
          width: '100%', // Let the Drawer control the width
          height: '100%',
          overflow: 'hidden', // Always hidden to prevent content jumping
          transition: 'all 0.3s ease',
        }}
      >
        {/* Resize Handle for Desktop */}
        <Box
          className="sidebar-resize-handle"
          onMouseDown={handleResizeStart}
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            height: '100%',
            width: '4px',
            cursor: 'ew-resize',
            backgroundColor: 'transparent',
            zIndex: 1000,
            '&:hover': {
              backgroundColor: '#1976d2',
              opacity: 0.8,
            },
          }}
        />

        {/* Header */}
        <Box className="sidebar-header">
          {!isCollapsed && (
            <Typography 
              variant="h6" 
              component="div"
              sx={{ 
                opacity: isCollapsed ? 0 : 1,
                transition: 'opacity 0.2s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden'
              }}
            >
              Chats
            </Typography>
          )}
          <Box className="header-actions">
            <IconButton 
              onClick={toggleCollapse} 
              size="small" 
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.1)',
                },
              }}
            >
              <ChatIcon />
            </IconButton>
            {!isCollapsed && (
              <IconButton 
                onClick={loadChats} 
                size="small" 
                title="Refresh chats"
                sx={{
                  ml: 0.5,
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.1)',
                  },
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Collapsed state - show only chat icons */}
        {isCollapsed ? (
          <Box className="collapsed-chat-list">
            <IconButton 
              onClick={handleNewChat} 
              className="collapsed-new-chat-button"
              title="New Chat"
              sx={{ width: '100%', borderRadius: '8px', mb: 1 }}
            >
              <AddIcon />
            </IconButton>
            <Divider />
            <Box className="collapsed-chats">
              {chats.slice(0, 8).map((chat) => (
                <IconButton
                  key={chat.id}
                  onClick={() => handleChatClick(chat.id)}
                  className={lcn('collapsed-chat-button', {
                    selected: currentChatId === chat.id,
                  })}
                  title={chat.title}
                  sx={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '8px',
                    mb: 0.5,
                    backgroundColor: currentChatId === chat.id ? theme.palette.primary.main : 'transparent',
                    color: currentChatId === chat.id ? 'white' : 'inherit',
                    '&:hover': {
                      backgroundColor: currentChatId === chat.id 
                        ? theme.palette.primary.dark 
                        : theme.palette.action.hover,
                    },
                  }}
                >
                  <ChatIcon fontSize="small" />
                </IconButton>
              ))}
            </Box>
          </Box>
        ) : (
          // Expanded state - show full content
          <>
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
                            {chat.title}
                          </Typography>
                          <Typography variant="caption" className="chat-date">
                            {formatDate(chat.createdAt)}
                          </Typography>
                        </Box>
                        <Box className="chat-actions">
                          <IconButton
                            size="small"
                            onClick={(e) => handleDeleteChat(e, chat.id)}
                            className="delete-button"
                            title="Delete chat"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </>
        )}
      </Box>
    </div>
  );

  // Always use permanent drawer with resize handle
  return (
    <Box sx={{ display: 'flex', position: 'relative', flexShrink: 0, height: '100%' }}>
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: sidebarWidth,
            height: '100%',
            transition: 'width 0.2s ease-in-out', // Faster transition
            position: 'relative',
            borderRight: '1px solid #e0e0e0',
            top: 0,
            margin: 0,
            padding: 0,
            overflow: 'hidden', // Prevent content overflow during transition
          },
        }}
      >
        {drawerContent}
      </Drawer>
      {/* External resize handle that extends full height */}
      <Box
        onMouseDown={handleResizeStart}
        sx={{
          position: 'absolute',
          right: -3,
          top: 0,
          bottom: 0,
          height: '100%',
          width: 6,
          cursor: 'col-resize',
          backgroundColor: 'transparent',
          zIndex: 1001, // Higher than internal handle
          '&:hover': {
            backgroundColor: '#1976d2',
            opacity: 0.8,
          },
        }}
      />
    </Box>
  );
};

ChatSidebar.propTypes = {
  onChatSelect: PropTypes.func.isRequired,
  currentChatId: PropTypes.string,
  onSidebarResize: PropTypes.func,
  shouldStartCollapsed: PropTypes.bool,
};

export default ChatSidebar;
