import PropTypes from 'prop-types';
import lcn from 'light-classnames';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { Person, SmartToy } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './ChatMessage.css';

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ChatMessage = ({ message }) => {
  const isUser = message.type === 'user';
  const isAssistant = message.type === 'assistant';

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

            {/* Timestamp */}
            <Typography
              variant="caption"
              className={lcn('timestamp', {
                user: isUser,
                assistant: isAssistant,
              })}
            >
              {formatTime(message.timestamp)}
            </Typography>
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
  }).isRequired,
};

export default ChatMessage;
