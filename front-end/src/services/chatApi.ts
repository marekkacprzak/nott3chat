import api from './api';

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  conversationId: string;
}

export const chatApi = {
  // Get all chats for the current user
  getChats: async (): Promise<Chat[]> => {
    const response = await api.get('/chats');
    return response.data;
  },

  // Create a new chat
  createNewChat: async (): Promise<string> => {
    const response = await api.post('/chats/new');
    return response.data.id; // Extract ID from NotT3ConversationDTO
  },

  // Fork a chat from a specific message
  forkChat: async (conversationId: string, messageId: string): Promise<string> => {
    const response = await api.post('/chats/fork', {
      conversationId,
      messageId
    });
    return response.data.id; // Extract ID from NotT3ConversationDTO
  },

  // Delete a chat
  deleteChat: async (conversationId: string): Promise<void> => {
    await api.delete(`/chats/${conversationId}`);
  },
};
