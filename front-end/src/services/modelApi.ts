import api from './api';

export interface Model {
  id: string;
  name: string;
  description?: string;
  provider?: string;
}

export const modelApi = {
  // Get all available models
  getModels: async (): Promise<Model[]> => {
    const response = await api.get('/models');
    return response.data;
  },
};
