import api from './api';

export const chatApi = {
  // Get all chats for the current user
  getChats: async () => {
    const response = await api.get('/chats');
    return response.data;
  },

  // Create a new chat
  createNewChat: async () => {
    const response = await api.post('/chats/new');
    return response.data; // Returns chatId as string
  },
};
