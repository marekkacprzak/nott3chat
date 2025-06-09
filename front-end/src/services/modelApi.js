import api from './api';

export const modelApi = {
  // Get all available models
  getModels: async () => {
    const response = await api.get('/models');
    return response.data;
  },
};
