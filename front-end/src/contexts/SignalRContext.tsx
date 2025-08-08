
import React, { createContext, useContext, useState, useEffect,
  useCallback, useRef, useMemo } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { useChats } from './ChatContext';
import { useNavigate } from 'react-router-dom';
import { Chat } from '@/services/chatApi';
import { HubConnection, RetryContext } from '@microsoft/signalr';
import type { LocalMessage } from '../Model/LocalMessage';
import type { ServerMessage } from '../Model/ServerMessage';

interface SignalRContextType {
  connection: signalR.HubConnection | null;
  isConnected: boolean;
  isConnecting: boolean;
  messages: LocalMessage[];
  currentAssistantMessage: LocalMessage | null;
  connectionError: string | null;
  chooseChat: (chatId: string | null) => Promise<void>;
  sendMessage: (model: string, message: string) => Promise<void>;
  regenerateMessage: (model: string, messageId: string) => Promise<void>;
  reconnect: () => Promise<void>;
}

interface SignalRProviderProps {
  children: React.ReactNode;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

/* eslint-disable react-refresh/only-export-components */
export const useSignalR = (): SignalRContextType => {
  const context = useContext(SignalRContext);
  if (!context) {
    throw new Error('useSignalR must be used within a SignalRProvider');
  }
  return context;
};

const serverMessageToLocal = (serverMsg: ServerMessage, isComplete: boolean = true): LocalMessage => ({
  id: serverMsg.id,
  index: serverMsg.index,
  type: serverMsg.role,
  content: serverMsg.content,
  timestamp: new Date(serverMsg.timestamp),
  isComplete,
  chatModel: serverMsg.chatModel || null,
  finishError: serverMsg.finishError || null,
});

const replaceOrAddMessage = (prevList: LocalMessage[], newMessage: LocalMessage): LocalMessage[] => {
  const existingIndex = prevList.findIndex(msg => msg.id === newMessage.id);
  if (existingIndex >= 0) {
    return [...prevList.slice(0, existingIndex), newMessage];
  }
  return [...prevList, newMessage];
};

export const SignalRProvider: React.FC<SignalRProviderProps> = ({ children }) => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState<LocalMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const currentChatId = useRef<string | null>(null);
  const isInitializing = useRef(false);
  const connectionAttempts = useRef(0);
  const navigate = useNavigate();
  
  const { isAuthenticated } = useAuth();
  const { addNewChat, updateChatTitle, deleteChat, loadChats } = useChats();
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  // Define event handlers as stable references outside of setupEventHandlers
  const handleConversationHistory = useCallback((convoId: string, messages: ServerMessage[]) => {
    if (convoId === currentChatId.current) {
      setMessages(messages.map((msg: ServerMessage) => serverMessageToLocal(msg)));
    }
  }, []);

  const handleUserMessage = useCallback((convoId: string, message: ServerMessage) => {
    if (convoId === currentChatId.current) {
      setMessages((prev) => replaceOrAddMessage(prev, serverMessageToLocal(message)));
    }
  }, []);

  const handleBeginAssistantMessage = useCallback((convoId: string, message: ServerMessage) => {
    if (convoId === currentChatId.current) {
      const newMessage = serverMessageToLocal(message, false);
      setCurrentAssistantMessage(newMessage);
      setMessages((prev) => replaceOrAddMessage(prev, newMessage));
    }
  }, []);

  const handleNewAssistantPart = useCallback((convoId: string, text: string) => {
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
  }, []);

  const handleEndAssistantMessage = useCallback((convoId: string, finishError: string | null) => {
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
  }, []);

  const handleRegenerateMessage = useCallback((convoId: string, messageId: string) => {
    if (convoId === currentChatId.current) {
      setMessages((prev) => {
        const messageIndex = prev.findIndex(msg => msg.id === messageId);
        if (messageIndex >= 0) {
          return prev.slice(0, messageIndex);
        }
        return prev;
      });
      setCurrentAssistantMessage(null);
    }
  }, []);

  const handleChatTitle = useCallback((titleChatId: string, title: string) => {
    updateChatTitle(titleChatId, title);
  }, [updateChatTitle]);

  const handleNewConversation = useCallback((convo: Chat) => {
    addNewChat(convo);
  }, [addNewChat]);

  const handleDeleteConversation = useCallback(async (convoId: string) => {
    await deleteChat(convoId, false);
  }, [deleteChat]);

  const handleClose = useCallback(() => {
    setIsConnected(false);
    setConnection(null);
  }, []);

  const handleReconnected = useCallback(() => {
    setIsConnected(true);
    setConnectionError(null);
    // Reload chats when reconnecting to get any updates that happened while disconnected
    loadChats();
    if (currentChatId.current) {
      connection?.invoke('ChooseChat', currentChatId.current).catch(() => navigate('/chat'));
    }
  }, [connection, navigate, loadChats]);

  const handleReconnecting = useCallback(() => {
    setIsConnected(false);
  }, []);

  const setupEventHandlers = useCallback((conn: HubConnection) => {
    // Clean up any existing handlers
    conn.off('ConversationHistory');
    conn.off('UserMessage');
    conn.off('BeginAssistantMessage');
    conn.off('NewAssistantPart');
    conn.off('EndAssistantMessage');
    conn.off('RegenerateMessage');
    conn.off('ChatTitle');
    conn.off('NewConversation');
    conn.off('DeleteConversation');

    // Set up new handlers
    conn.on('ConversationHistory', handleConversationHistory);
    conn.on('UserMessage', handleUserMessage);
    conn.on('BeginAssistantMessage', handleBeginAssistantMessage);
    conn.on('NewAssistantPart', handleNewAssistantPart);
    conn.on('EndAssistantMessage', handleEndAssistantMessage);
    conn.on('RegenerateMessage', handleRegenerateMessage);
    conn.on('ChatTitle', handleChatTitle);
    conn.on('NewConversation', handleNewConversation);
    conn.on('DeleteConversation', handleDeleteConversation);

    conn.onclose(handleClose);
    conn.onreconnected(handleReconnected);
    conn.onreconnecting(handleReconnecting);
  }, [
    handleConversationHistory,
    handleUserMessage,
    handleBeginAssistantMessage,
    handleNewAssistantPart,
    handleEndAssistantMessage,
    handleRegenerateMessage,
    handleChatTitle,
    handleNewConversation,
    handleDeleteConversation,
    handleClose,
    handleReconnected,
    handleReconnecting,
  ]);

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
    isInitializing.current = false;
    connectionAttempts.current = 0; // Reset connection attempts
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [connection]);

  const chooseChat = useCallback(async (chatId: string | null) => {
    if (!connection || !isConnected) {
      currentChatId.current = chatId;
      setMessages([]);
      setCurrentAssistantMessage(null);
      return;
    }

    try {
      currentChatId.current = chatId;
      setMessages([]);
      setCurrentAssistantMessage(null);
      
      if (chatId) {
        try {
          await connection.invoke('ChooseChat', chatId);
        } catch {
          navigate('/chat');
        }
      }
    } catch (error) {
      console.error('Error choosing chat:', error);
    }
  }, [connection, isConnected, navigate]);

  const sendMessage = useCallback(
    async (model: string, message: string) => {
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
    async (model: string, messageId: string) => {
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
    if (connection || isInitializing.current) return;

    isInitializing.current = true;
    setIsConnecting(true);
    setConnectionError(null);

    const url = `${import.meta.env.VITE_API_URL}/chat`;

    const attemptConnection = () => {
      //console.log(`SignalR connection attempt ${connectionAttempts.current + 1}`);
      
      // Check for stored SignalR JWT token (primary auth method)
      const signalRToken = localStorage.getItem('signalRToken');
      
      let connectionOptions: signalR.IHttpConnectionOptions = {
        withCredentials: true,
        transport:
          signalR.HttpTransportType.WebSockets |
          signalR.HttpTransportType.LongPolling,
        skipNegotiation: false,
      };
      
      // Use accessTokenFactory for JWT token authentication (supports WebSockets)
      if (signalRToken) {
        connectionOptions.accessTokenFactory = () => {
          // Always get the latest token from localStorage
          const currentToken = localStorage.getItem('signalRToken');
          return currentToken || '';
        };
      } else {
        console.log('🚫 No SignalR JWT token found - cannot connect to SignalR');
        return; // Don't attempt connection without proper token
      }
      
      const newConnection = new signalR.HubConnectionBuilder()
        .withUrl(url, connectionOptions)
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext: RetryContext) => {
            if (retryContext.elapsedMilliseconds < 60000) {
              return Math.random() * 10000;
            } else {
              return null;
            }
          },
        })
        .configureLogging(
          import.meta.env.PROD 
            ? signalR.LogLevel.Warning  // Production: Only warnings and errors
            : signalR.LogLevel.Information  // Development: Full logging
        )
        .build();

      setupEventHandlers(newConnection);
      
      newConnection
        .start()
        .then(() => {
          // let transportName = 'Unknown';
          
          // if (newConnection.connection?.transport?.constructor?.name) {
          //   const constructorName = newConnection.connection.transport.constructor.name;
          //   if (constructorName.includes('WebSocket')) {
          //     transportName = 'WebSockets';
          //   } else if (constructorName.includes('LongPolling')) {
          //     transportName = 'Long Polling';
          //   } else if (constructorName.includes('ServerSentEvents')) {
          //     transportName = 'Server-Sent Events';
          //   } else {
          //     transportName = constructorName;
          //   }
          // }
          console.debug(`✅ SignalR connection established successfully`);

          setConnection(newConnection);
          setIsConnected(true);
          setIsConnecting(false);
          setConnectionError(null);
          isInitializing.current = false;
          connectionAttempts.current = 0; // Reset attempts on success
        })
        .catch((error) => {
          console.error(`SignalR connection error (attempt ${connectionAttempts.current + 1}):`, error);
          connectionAttempts.current++;
          setConnectionError(error.message);
          setIsConnecting(false);
          isInitializing.current = false;
          
          if (error.statusCode === 401) {
            console.error('SignalR authentication failed - cookies may not be properly configured');
          }

          // If this is the first failure, wait 20 seconds before next attempt
          if (connectionAttempts.current === 1) {
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              attemptConnection();
            }, 20000); // 20 seconds delay
          }
        });
    };

    attemptConnection();
  }, [connection, setupEventHandlers]);

  const reconnect = useCallback(async (): Promise<void> => {
    if (isConnecting) return; // Already connecting, don't start another
  
    // Force close any existing connection
    closeConnection();
    // Reset connection attempts for manual reconnect
    connectionAttempts.current = 0;
    // Reload chats when manually reconnecting
    loadChats();
    await initializeConnection();
  }, [isConnecting, closeConnection, initializeConnection, loadChats]);
  
  // Initialize connection when authenticated
  useEffect(() => {
    if (isAuthenticated && !connection) {
      initializeConnection();
    } else if (!isAuthenticated && connection) {
      closeConnection();
    }
  }, [isAuthenticated, initializeConnection, closeConnection, connection]);

  // Clean up connection on page unload
  useEffect(() => {
    return () => {
      // Also clean up when component unmounts
      if (connection) {
        connection.stop();
      }
    };
  }, [connection]);

  
  const value = useMemo((): SignalRContextType => ({
    // Connection state
    connection,
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
    connection,
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

