import PropTypes from 'prop-types';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { Person, SmartToy } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2,
        mx: 1,
      }}
    >
      <Box
        sx={{
          maxWidth: '70%',
          display: 'flex',
          flexDirection: isUser ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          gap: 1,
        }}
      >
        {/* Avatar */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: isUser ? 'primary.main' : 'secondary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0,
            mt: 0.5,
          }}
        >
          {isUser ? <Person fontSize="small" /> : <SmartToy fontSize="small" />}
        </Box>

        {/* Message Content */}
        <Paper
          elevation={1}
          sx={{
            px: 2,
            py: 1.5,
            backgroundColor: isUser
              ? 'primary.main'
              : message.isComplete
                ? 'grey.100'
                : 'grey.50',
            color: isUser ? 'primary.contrastText' : 'text.primary',
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            position: 'relative',
          }}
        >
          {/* Message Content */}
          <Box sx={{ wordBreak: 'break-word' }}>
            {isAssistant ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <Typography
                      variant="body1"
                      component="div"
                      sx={{ mb: 1, '&:last-child': { mb: 0 } }}
                    >
                      {children}
                    </Typography>
                  ),
                  code: ({ inline, children }) =>
                    inline ? (
                      <Box
                        component="code"
                        sx={{
                          backgroundColor: 'rgba(0, 0, 0, 0.1)',
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          fontFamily: 'monospace',
                          fontSize: '0.9em',
                        }}
                      >
                        {children}
                      </Box>
                    ) : (
                      <Box
                        component="pre"
                        sx={{
                          backgroundColor: 'rgba(0, 0, 0, 0.1)',
                          p: 1,
                          borderRadius: 1,
                          overflow: 'auto',
                          fontFamily: 'monospace',
                          fontSize: '0.9em',
                          my: 1,
                        }}
                      >
                        <code>{children}</code>
                      </Box>
                    ),
                  ul: ({ children }) => (
                    <Box component="ul" sx={{ pl: 2, my: 1 }}>
                      {children}
                    </Box>
                  ),
                  ol: ({ children }) => (
                    <Box component="ol" sx={{ pl: 2, my: 1 }}>
                      {children}
                    </Box>
                  ),
                  blockquote: ({ children }) => (
                    <Box
                      sx={{
                        borderLeft: '4px solid',
                        borderColor: 'grey.400',
                        pl: 2,
                        ml: 1,
                        fontStyle: 'italic',
                        my: 1,
                      }}
                    >
                      {children}
                    </Box>
                  ),
                }}
              >
                {message.content || ''}
              </ReactMarkdown>
            ) : (
              <Typography variant="body1">{message.content}</Typography>
            )}

            {/* Loading indicator for incomplete assistant messages */}
            {isAssistant && !message.isComplete && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Thinking...
                </Typography>
              </Box>
            )}
          </Box>

          {/* Timestamp */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: isUser ? 'right' : 'left',
              mt: 0.5,
              opacity: 0.7,
              fontSize: '0.75rem',
            }}
          >
            {formatTime(message.timestamp)}
          </Typography>
        </Paper>
      </Box>
    </Box>
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
