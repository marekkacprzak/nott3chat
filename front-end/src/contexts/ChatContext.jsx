import PropTypes from 'prop-types';
import { createContext, useContext, useState, useCallback } from 'react';
import { chatApi } from '../services/chatApi';

const ChatContext = createContext(null);

export const useChats = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadChats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const chatData = await chatApi.getChats();
      setChats(chatData);
      setHasLoaded(true);
    } catch (err) {
      setError('Failed to load chats');
      console.error('Error loading chats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addNewChat = useCallback((newChat) => {
    setChats((prev) => [newChat, ...prev]);
  }, []);

  const value = {
    chats,
    loading,
    error,
    hasLoaded,
    loadChats,
    addNewChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
