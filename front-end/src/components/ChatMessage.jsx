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
  Chip
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
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
  onForkChat 
}) => {
  const { models } = useModels();
  const [regenerateMenuAnchor, setRegenerateMenuAnchor] = useState(null);
  const isUser = useMemo(() => message.type === 'user', [message]);
  const isAssistant = useMemo(() => message.type === 'assistant', [message]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
  }, [message]);

  const handleBranch = useCallback(() => {
    onForkChat(message.id);
  }, [onForkChat, message]);

  const handleRegenerateClick = useCallback(() => {
    // Use the message's original model or fall back to selected model
    const modelToUse = message.chatModel || selectedModel;
    if (modelToUse) {
      onRegenerateMessage(modelToUse, message.id);
    }
  }, [message.chatModel, selectedModel, onRegenerateMessage, message.id]);

  const handleRegenerateDropdownClick = useCallback((event) => {
    event.stopPropagation();
    setRegenerateMenuAnchor(event.currentTarget);
  }, []);

  const handleRegenerateWithModel = useCallback((modelName) => {
    onSetSelectedModel(modelName);
    onRegenerateMessage(modelName, message.id);
    setRegenerateMenuAnchor(null);
  }, [onRegenerateMessage, message, onSetSelectedModel]);

  const handleCloseRegenerateMenu = useCallback(() => {
    setRegenerateMenuAnchor(null);
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
          {/* Avatar */}
          <Box
            className={lcn('avatar', {
              user: isUser,
              assistant: isAssistant,
            })}
          >
            {isUser ? (
              <Person fontSize="small" />
            ) : (
              <SmartToy fontSize="small" />
            )}
          </Box>

          {/* Message Content */}
          <Paper
            elevation={1}
            className={lcn('message-paper', {
              user: isUser,
              assistant: isAssistant,
              complete: isAssistant && message.isComplete,
              incomplete: isAssistant && !message.isComplete,
            })}
          >
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
                            style={vscDarkPlus}
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
};

export default ChatMessage;
