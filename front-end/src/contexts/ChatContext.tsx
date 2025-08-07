
import React, { createContext, useContext, useState, useCallback } from 'react';
import { chatApi, Chat } from '../services/chatApi';

interface ChatContextType {
  chats: Chat[];
  loading: boolean;
  error: string;
  hasLoaded: boolean;
  loadChats: () => Promise<void>;
  addNewChat: (newChat: Chat) => void;
  updateChatTitle: (chatId: string, newTitle: string) => void;
  deleteChat: (chatId: string, callApi?: boolean) => Promise<boolean>;
}

interface ChatProviderProps {
  children: React.ReactNode;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChats = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChats must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  
  const loadChats = useCallback(async (): Promise<void> => {
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

  const addNewChat = useCallback((newChat: Chat): void => {
    setChats((prev) => prev.some(c => c.id === newChat.id) ? prev : [newChat, ...prev]);
  }, []);

  const updateChatTitle = useCallback((chatId: string, newTitle: string): void => {
    setChats((prev) => 
      prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, title: newTitle }
          : chat
      )
    );
  }, []);

  const deleteChat = useCallback(async (chatId: string, callApi: boolean = true): Promise<boolean> => {
    try {
      if (callApi)
        await chatApi.deleteChat(chatId);
      setChats((prev) => prev.filter(chat => chat.id !== chatId));
      
      return true;
    } catch (err) {
      console.error('Error deleting chat:', err);
      return false;
    }
  }, []);

  const value: ChatContextType = {
    chats,
    loading,
    error,
    hasLoaded,
    loadChats,
    addNewChat,
    updateChatTitle,
    deleteChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};


