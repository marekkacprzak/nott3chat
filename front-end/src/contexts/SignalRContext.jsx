import PropTypes from 'prop-types';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { useChats } from './ChatContext';

const SignalRContext = createContext();

export const useSignalR = () => {
  const context = useContext(SignalRContext);
  if (!context) {
    throw new Error('useSignalR must be used within a SignalRProvider');
  }
  return context;
};

const serverMessageToLocal = (serverMsg, isComplete = true) => ({
  id: serverMsg.id,
  index: serverMsg.index,
  type: serverMsg.role,
  content: serverMsg.content,
  timestamp: new Date(serverMsg.timestamp),
  isComplete,
  chatModel: serverMsg.chatModel || null,
  finishError: serverMsg.finishError || null,
});

const replaceOrAddMessage = (prevList, newMessage) => {
  const existingIndex = prevList.findIndex(msg => msg.id === newMessage.id);
  if (existingIndex >= 0) {
    return [...prevList.slice(0, existingIndex), newMessage];
  }
  return [...prevList, newMessage];
};

export const SignalRProvider = ({ children }) => {
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const currentChatId = useRef(null);
  
  const { isAuthenticated } = useAuth();
  const { addNewChat, updateChatTitle, deleteChat } = useChats();
  const reconnectTimeoutRef = useRef(null);
  const setupEventHandlers = useCallback((conn) => {
    // Chat-specific events (filtered by current chat)
    conn.on('ConversationHistory', (convoId, messages) => {
      if (convoId === currentChatId.current) {
        setMessages(messages.map((msg) => serverMessageToLocal(msg)));
      }
    });

    conn.on('UserMessage', (convoId, message) => {
      if (convoId === currentChatId.current) {
        setMessages((prev) => replaceOrAddMessage(prev, serverMessageToLocal(message)));
      }
    });

    conn.on('BeginAssistantMessage', (convoId, message) => {
      if (convoId === currentChatId.current) {
        const newMessage = serverMessageToLocal(message, false);
        setCurrentAssistantMessage(newMessage);
        setMessages((prev) => replaceOrAddMessage(prev, newMessage));
      }
    });

    conn.on('NewAssistantPart', (convoId, text) => {
      if (convoId === currentChatId.current) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.type === 'assistant' && !msg.isComplete
              ? { ...msg, content: msg.content + text }
              : msg
          )
        );
        setCurrentAssistantMessage((prev) =>
          prev ? { ...prev, content: prev.content + text } : prev
        );
      }
    });

    conn.on('EndAssistantMessage', (convoId, finishError) => {
      if (convoId === currentChatId.current) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.type === 'assistant' && !msg.isComplete
              ? { ...msg, isComplete: true, finishError: finishError || null }
              : msg
          )
        );
        setCurrentAssistantMessage(null);
      }
    });

    // Global events (not filtered)
    conn.on('ChatTitle', (titleChatId, title) => {
      updateChatTitle(titleChatId, title);
    });

    conn.on('NewConversation', (convo) => addNewChat(convo));
    conn.on('DeleteConversation', async (convoId) => {
      await deleteChat(convoId, false);
    });

    conn.onclose(() => {
      setIsConnected(false);
      setConnection(null);
    });

    conn.onreconnected(() => {
      setIsConnected(true);
      setConnectionError(null);
      // Re-choose current chat if we have one
      if (currentChatId.current) {
        conn.invoke('ChooseChat', currentChatId.current).catch(console.error);
      }
    });

    conn.onreconnecting(() => {
      setIsConnected(false);
    });
  }, [updateChatTitle, addNewChat, deleteChat]);

  const closeConnection = useCallback(() => {
    if (connection) {
      connection.stop();
      setConnection(null);
    }
    setIsConnected(false);
    setIsConnecting(false);
    setMessages([]);
    setCurrentAssistantMessage(null);
    setConnectionError(null);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [connection]);

  const chooseChat = useCallback(async (chatId) => {
    if (!connection || !isConnected) {
      currentChatId.current = chatId;
      return;
    }

    try {
      currentChatId.current = chatId;
      setMessages([]);
      setCurrentAssistantMessage(null);
      
      if (chatId) {
        await connection.invoke('ChooseChat', chatId);
      }
    } catch (error) {
      console.error('Error choosing chat:', error);
    }
  }, [connection, isConnected]);

  const sendMessage = useCallback(
    async (model, message) => {
      console.log(currentChatId.current);
      if (connection && isConnected && currentChatId.current) {
        try {
          await connection.invoke('NewMessage', model, message);
        } catch (error) {
          console.error('Error sending message:', error);
        }
      }
    },
    [connection, isConnected]
  );

  const regenerateMessage = useCallback(
    async (model, messageId) => {
      if (connection && isConnected && currentChatId.current) {
        try {
          await connection.invoke('RegenerateMessage', model, messageId);
        } catch (error) {
          console.error('Error regenerating message:', error);
        }
      }
    },
    [connection, isConnected]
  );

  const initializeConnection = useCallback(() => {
    if (connection) return;

    setIsConnecting(true);
    setConnectionError(null);

    const url = `${import.meta.env.VITE_API_URL}/chat`;

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(url, {
        withCredentials: true,
        transport:
          signalR.HttpTransportType.WebSockets |
          signalR.HttpTransportType.LongPolling,
        skipNegotiation: false,
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.elapsedTime < 60000) {
            return Math.random() * 10000;
          } else {
            return null;
          }
        },
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    setupEventHandlers(newConnection);
    
    newConnection
      .start()
      .then(() => {
        setConnection(newConnection);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
      })
      .catch((error) => {
        console.error('SignalR connection error:', error);
        setConnectionError(error.message);
        setIsConnecting(false);
        if (error.statusCode === 401) {
          console.error('SignalR authentication failed - cookies may not be properly configured');
        }
      });
  }, [connection, setupEventHandlers]);

  const reconnect = useCallback(() => {
    if (!isConnecting && !isConnected) {
      closeConnection();
      initializeConnection();
    }
  }, [isConnecting, isConnected, closeConnection, initializeConnection]);
  
  // Initialize connection when authenticated
  useEffect(() => {
    if (isAuthenticated && !connection) {
      initializeConnection();
    } else if (!isAuthenticated && connection) {
      closeConnection();
    }
  }, [isAuthenticated, initializeConnection, closeConnection, connection]);

  
  const value = useMemo(() => ({
    // Connection state
    isConnected,
    isConnecting,
    connectionError,
    
    // Chat state
    messages,
    currentAssistantMessage,
    
    // Actions
    chooseChat,
    sendMessage,
    regenerateMessage,
    reconnect,
  }), [
    isConnected,
    isConnecting,
    connectionError,
    messages,
    currentAssistantMessage,
    chooseChat,
    sendMessage,
    regenerateMessage,
    reconnect,
  ]);

  return (
    <SignalRContext.Provider value={value}>
      {children}
    </SignalRContext.Provider>
  );
};

SignalRProvider.propTypes = {
  children: PropTypes.node.isRequired,
};