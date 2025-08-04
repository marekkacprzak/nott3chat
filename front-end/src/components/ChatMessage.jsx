import PropTypes from 'prop-types';
import { useCallback, useMemo, useState } from 'react';
import lcn from 'light-classnames';
import { 
  Box, 
  Paper, 
  Typography, 
  CircularProgress, 
  IconButton, 
  Tooltip, 
  Menu, 
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  useTheme
} from '@mui/material';
import { 
  Person, 
  SmartToy, 
  ContentCopy, 
  CallSplit, 
  Refresh, 
  KeyboardArrowDown 
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useModels } from '../contexts/ModelsContext';
import './ChatMessage.css';

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ChatMessage = ({ 
  message, 
  selectedModel, 
  onSetSelectedModel, 
  onRegenerateMessage, 
  onForkChat,
  isLastMessage
}) => {
  const { models } = useModels();
  const theme = useTheme();
  const [regenerateMenuAnchor, setRegenerateMenuAnchor] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingRegenerate, setPendingRegenerate] = useState(null);
  const isUser = useMemo(() => message.type === 'user', [message]);
  const isAssistant = useMemo(() => message.type === 'assistant', [message]);
  
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
  }, [message]);

  const handleBranch = useCallback(() => {
    onForkChat(message.id);
  }, [onForkChat, message]);

  const handleRegenerateDropdownClick = useCallback((event) => {
    event.stopPropagation();
    setRegenerateMenuAnchor(event.currentTarget);
  }, []);

  const handleRegenerate = useCallback((modelName, messageId) => {
    if (isLastMessage) {
      // If this is the last message, regenerate directly
      onRegenerateMessage(modelName, messageId);
    } else {
      // If not the last message, show confirmation dialog
      setPendingRegenerate({ model: modelName, messageId });
      setConfirmDialogOpen(true);
    }
  }, [onRegenerateMessage, isLastMessage])

  const handleRegenerateClick = useCallback(() => {
    const modelToUse = message.chatModel || selectedModel;
    if (!modelToUse) return;
    
    handleRegenerate(modelToUse, message.id);
  }, [message.chatModel, selectedModel, handleRegenerate, message.id]);

  const handleRegenerateWithModel = useCallback((modelName) => {
    onSetSelectedModel(modelName);
    setRegenerateMenuAnchor(null);
    
    handleRegenerate(modelName, message.id);
  }, [handleRegenerate, message.id, onSetSelectedModel]);

  const handleCloseRegenerateMenu = useCallback(() => {
    setRegenerateMenuAnchor(null);
  }, []);

  const handleConfirmRegenerate = useCallback(() => {
    if (pendingRegenerate) {
      onRegenerateMessage(pendingRegenerate.model, pendingRegenerate.messageId);
    }
    setConfirmDialogOpen(false);
    setPendingRegenerate(null);
  }, [pendingRegenerate, onRegenerateMessage]);

  const handleCancelRegenerate = useCallback(() => {
    setConfirmDialogOpen(false);
    setPendingRegenerate(null);
  }, []);

  return (
    <div className="chat-message">
      <Box
        className={lcn('message-container', {
          user: isUser,
          assistant: isAssistant,
        })}
      >
        <Box
          className={lcn('message-content', {
            user: isUser,
            assistant: isAssistant,
          })}
        >
          {/* Message Content */}
          <Paper
            elevation={1}
            className={lcn('message-paper', {
              user: isUser,
              assistant: isAssistant,
              complete: isAssistant && message.isComplete,
              incomplete: isAssistant && !message.isComplete,
            })}
            sx={{
              backgroundColor: isUser 
                ? theme.palette.primary.main 
                : theme.palette.background.paper,
              color: isUser 
                ? theme.palette.primary.contrastText 
                : theme.palette.text.primary,
              '&.assistant.incomplete': {
                backgroundColor: theme.palette.mode === 'dark' 
                  ? theme.palette.grey[800] 
                  : theme.palette.grey[100],
              },
            }}
          >
            {/* Avatar inside message paper */}
            <Box
              className={lcn('avatar', {
                user: isUser,
                assistant: isAssistant,
              })}
              sx={{
                backgroundColor: isUser 
                  ? theme.palette.primary.dark 
                  : theme.palette.mode === 'dark' 
                    ? theme.palette.grey[700] 
                    : theme.palette.grey[200],
                color: isUser 
                  ? theme.palette.primary.contrastText 
                  : theme.palette.text.primary,
              }}
            >
              {isUser ? (
                <Person fontSize="small" />
              ) : (
                <SmartToy fontSize="small" />
              )}
            </Box>
            {/* Message Content */}
            <div className="markdown-content">
              {isAssistant ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    code: ({ inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      const language = match ? match[1] : '';
                      
                      // Properly extract text content from children
                      const getTextContent = (node) => {
                        if (typeof node === 'string') return node;
                        if (Array.isArray(node)) return node.map(getTextContent).join('');
                        if (node && node.props && node.props.children) return getTextContent(node.props.children);
                        return '';
                      };
                      
                      const codeString = getTextContent(children).replace(/\n$/, '');
                      
                      return !inline && language ? (
                        <div className="markdown-code-block">
                          <SyntaxHighlighter
                            style={theme.palette.mode === 'dark' ? vscDarkPlus : vs}
                            language={language}
                            PreTag="div"
                            {...props}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className="markdown-code-inline" {...props}>
                          {codeString}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <div className="markdown-pre">{children}</div>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="markdown-blockquote">{children}</blockquote>
                    )
                  }}
                >
                  {message.content || ''}
                </ReactMarkdown>
              ) : (
                <Typography variant="body1">{message.content}</Typography>
              )}

              {/* Loading indicator for incomplete assistant messages */}
              {isAssistant && !message.isComplete && (
                <Box className="loading-indicator">
                  <CircularProgress size={16} className="spinner" />
                  <Typography variant="caption" color="text.secondary">
                    Thinking...
                  </Typography>
                </Box>
              )}
            </div>

            {/* Error Display */}
            {message.finishError && (
              <Box className="error-message">
                <Typography variant="caption" color="error">
                  {message.finishError}
                </Typography>
              </Box>
            )}

            {/* Model Info and Timestamp */}
            <Box className="message-footer">
              <Box className="message-meta">
                {message.chatModel && (
                  <Chip 
                    label={message.chatModel} 
                    size="small" 
                    variant="outlined" 
                    className="model-chip"
                  />
                )}
                <Typography
                  variant="caption"
                  className={lcn('timestamp', {
                    user: isUser,
                    assistant: isAssistant,
                  })}
                >
                  {formatTime(message.timestamp)}
                </Typography>
              </Box>
              
              {/* Action Icons for Assistant Messages */}
              {isAssistant && message.isComplete && (
                <Box className={lcn("message-actions", {"force-visible": Boolean(regenerateMenuAnchor)})}>
                  <Tooltip title="Copy">
                    <IconButton size="small" onClick={handleCopy}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Branch">
                    <IconButton size="small" onClick={handleBranch}>
                      <CallSplit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Regenerate">
                    <IconButton size="small" onClick={handleRegenerateClick}>
                      <Refresh fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton 
                    size="small" 
                    onClick={handleRegenerateDropdownClick}
                    className="regenerate-dropdown"
                  >
                    <KeyboardArrowDown fontSize="small" />
                  </IconButton>
                  
                  {/* Regenerate Model Selection Menu */}
                  <Menu
                    anchorEl={regenerateMenuAnchor}
                    open={Boolean(regenerateMenuAnchor)}
                    onClose={handleCloseRegenerateMenu}
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'left',
                    }}
                    transformOrigin={{
                      vertical: 'bottom',
                      horizontal: 'left',
                    }}
                  >
                    {models.map((model) => (
                      <MenuItem 
                        key={model.name} 
                        onClick={() => handleRegenerateWithModel(model.name)}
                        selected={model.name === selectedModel}
                      >
                        <Typography variant="body2">{model.name}</Typography>
                      </MenuItem>
                    ))}
                  </Menu>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>
      
      {/* Regenerate Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={handleCancelRegenerate}
        aria-labelledby="regenerate-dialog-title"
        aria-describedby="regenerate-dialog-description"
      >
        <DialogTitle id="regenerate-dialog-title">
          Regenerate Message
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="regenerate-dialog-description">
            This will regenerate this message and <strong>delete all messages that come after it</strong> in the conversation. 
            This action cannot be undone.
            <br /><br />
            Are you sure you want to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelRegenerate} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmRegenerate} color="error" variant="contained">
            Regenerate & Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

ChatMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    type: PropTypes.oneOf(['user', 'assistant']).isRequired,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.instanceOf(Date).isRequired,
    isComplete: PropTypes.bool.isRequired,
    chatModel: PropTypes.string,
    finishError: PropTypes.string,
  }).isRequired,
  selectedModel: PropTypes.string,
  onSetSelectedModel: PropTypes.func,
  onRegenerateMessage: PropTypes.func,
  onForkChat: PropTypes.func,
  isLastMessage: PropTypes.bool,
};

export default ChatMessage;
