import { useEffect, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

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
  // Replace message if ID exists, otherwise add new
  const existingIndex = prevList.findIndex(msg => msg.id === newMessage.id);
  if (existingIndex >= 0) {
    return [...prevList.slice(0, existingIndex), newMessage];
  }
  return [...prevList, newMessage];
}

export const useSignalR = (chatId) => {
  const [connection, setConnection] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState(null);
  const [chatTitle, setChatTitle] = useState(null);

  useEffect(() => {
    // Clean up any existing connection first
    setConnection((prevConnection) => {
      if (
        prevConnection &&
        prevConnection.state !== signalR.HubConnectionState.Disconnected
      ) {
        prevConnection.stop();
      }
      return null;
    });

    setIsConnected(false);
    setMessages([]);
    setCurrentAssistantMessage(null);
    setChatTitle(null);

    if (!chatId) {
      return;
    }

    const url = `${import.meta.env.VITE_API_URL}/chat/${chatId}`;

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

    setConnection(newConnection);

    return () => {
      if (
        newConnection &&
        newConnection.state !== signalR.HubConnectionState.Disconnected
      ) {
        newConnection.stop();
      }
    };
  }, [chatId]);

  useEffect(() => {
    if (!connection) return;

    // Remove any existing event handlers to prevent duplicates
    connection.off('ConversationHistory');
    connection.off('UserMessage');
    connection.off('BeginAssistantMessage');
    connection.off('NewAssistantPart');
    connection.off('EndAssistantMessage');
    connection.off('RegenerateMessage');
    connection.off('ChatTitle');

    connection
      .start()
      .then(() => {
        setIsConnected(true);

        connection.on('ConversationHistory', (messages) => {
          setMessages(messages.map((msg) => serverMessageToLocal(msg)));
        });

        // Handle user messages
        connection.on('UserMessage', (message) => {
          setMessages((prev) => replaceOrAddMessage(prev, serverMessageToLocal(message)));
        });

        // Begin assistant message
        connection.on('BeginAssistantMessage', (message) => {
          const newMessage = serverMessageToLocal(message, false);
          setCurrentAssistantMessage(newMessage);
          setMessages((prev) => replaceOrAddMessage(prev, newMessage));
        });

        // Add text to current assistant message
        connection.on('NewAssistantPart', (text) => {
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
        });

        // End assistant message
        connection.on('EndAssistantMessage', (finishError) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.type === 'assistant' && !msg.isComplete
                ? { ...msg, isComplete: true, finishError: finishError || null }
                : msg
            )
          );
          setCurrentAssistantMessage(null);
        });

        // Handle chat title updates
        connection.on('ChatTitle', (title) => {
          setChatTitle(title);
        });
      })
      .catch((error) => {
        console.error('SignalR connection error:', error);
        if (error.statusCode === 401) {
          console.error(
            'SignalR authentication failed - cookies may not be properly configured'
          );
        }
        setIsConnected(false);
      });

    connection.onclose(() => {
      setIsConnected(false);
    });

    connection.onreconnected(() => {
      setIsConnected(true);
    });

    return () => {
      // Clean up event handlers when connection changes
      if (connection) {
        connection.off('ConversationHistory');
        connection.off('UserMessage');
        connection.off('BeginAssistantMessage');
        connection.off('NewAssistantPart');
        connection.off('EndAssistantMessage');
        connection.off('RegenerateMessage');
        connection.off('ChatTitle');
      }
    };
  }, [connection]);

  const sendMessage = useCallback(
    async (model, message) => {
      if (connection && isConnected) {
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
      if (connection && isConnected) {
        try {
          await connection.invoke('RegenerateMessage', model, messageId);
        } catch (error) {
          console.error('Error regenerating message:', error);
        }
      }
    },
    [connection, isConnected]
  );

  return {
    messages,
    sendMessage,
    regenerateMessage,
    isConnected,
    currentAssistantMessage,
    chatTitle,
  };
};
