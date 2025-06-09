import { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
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
  Close as CloseIcon,
  Add as AddIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import { useChats } from '../contexts/ChatContext';
import { formatDate } from '../extra/utils';

const ChatSidebar = ({ isOpen, onToggle, onChatSelect, currentChatId }) => {
  const { chats, loading, error, hasLoaded, loadChats } = useChats();

  const autoToggleSidebar = useCallback(() => {
    // Don't close sidebar on desktop, only on mobile
    if (window.innerWidth < 900) onToggle();
  }, [onToggle]);

  // Load chats once when component mounts if not already loaded
  useEffect(() => {
    if (!hasLoaded) {
      loadChats();
    }
  }, [hasLoaded, loadChats]);

  const handleNewChat = useCallback(() => {
    onChatSelect(null); // null indicates new chat
    autoToggleSidebar();
  }, [onChatSelect, autoToggleSidebar]);

  const handleChatClick = useCallback(
    (chatId) => {
      onChatSelect(chatId);
      autoToggleSidebar();
    },
    [onChatSelect, autoToggleSidebar]
  );

  const drawerContent = (
    <Box
      sx={{
        width: 300,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" component="div">
          Chats
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={loadChats} size="small" title="Refresh chats">
            <ChatIcon />
          </IconButton>
          <IconButton
            onClick={onToggle}
            size="small"
            sx={{ display: { md: 'none' } }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* New Chat Button */}
      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={handleNewChat}
          sx={{
            borderRadius: 2,
            border: 1,
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
            },
          }}
        >
          <AddIcon sx={{ mr: 1 }} />
          <ListItemText primary="New Chat" />
        </ListItemButton>
      </Box>

      <Divider />

      {/* Chat List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100px',
            }}
          >
            <CircularProgress size={24} />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : chats.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              color: 'text.secondary',
            }}
          >
            <ChatIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2">No chats yet</Typography>
            <Typography variant="caption">Start a new conversation!</Typography>
          </Box>
        ) : (
          <List sx={{ p: 1 }}>
            {chats.map((chat) => (
              <ListItem key={chat.id} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleChatClick(chat.id)}
                  selected={currentChatId === chat.id}
                  sx={{
                    borderRadius: 2,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                    },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: currentChatId === chat.id ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Chat {chat.id.substring(0, 8)}...
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        opacity: 0.7,
                        fontSize: '0.7rem',
                      }}
                    >
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
  );

  return (
    <>
      {/* Desktop Drawer */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={isOpen}
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 300,
            top: '64px', // Height of AppBar
            height: 'calc(100vh - 64px)',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={isOpen}
        onClose={onToggle}
        ModalProps={{
          keepMounted: true, // Better performance on mobile
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 300,
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

ChatSidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onChatSelect: PropTypes.func.isRequired,
  currentChatId: PropTypes.string,
};

export default ChatSidebar;
