import PropTypes from 'prop-types';
import { createContext, useContext, useState, useCallback } from 'react';
import { chatApi } from '../services/chatApi';
import { useNavigate } from 'react-router-dom';

const ChatContext = createContext(null);

export const useChats = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const navigate = useNavigate();
  
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
    setChats((prev) => prev.some(c => c.id === newChat.id) ? prev : [newChat, ...prev]);
  }, []);

  const updateChatTitle = useCallback((chatId, newTitle) => {
    setChats((prev) => 
      prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, title: newTitle }
          : chat
      )
    );
  }, []);

  const deleteChat = useCallback(async (chatId, callApi = true) => {
    try {
      if (callApi)
        await chatApi.deleteChat(chatId);
      setChats((prev) => prev.filter(chat => chat.id !== chatId));
      
      // If the deleted chat is the current one, navigate to new chat
      if (currentChatId === chatId) {
        navigate('/chat');
      }
      
      return true;
    } catch (err) {
      console.error('Error deleting chat:', err);
      return false;
    }
  }, [currentChatId, navigate]);

  const value = {
    chats,
    loading,
    error,
    hasLoaded,
    loadChats,
    addNewChat,
    updateChatTitle,
    deleteChat,
    setCurrentChatId,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
