import axios from 'axios';
import { navigateTo } from './navigationService';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        navigateTo('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
