import axios from 'axios';
import { navigateTo } from './navigationService';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.url && error.url!='/manage/info')
    console.error('🚨 API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      hasToken: !!localStorage.getItem('authToken'),
      withCredentials: error.config?.withCredentials,
      headers: error.response?.headers
    });
    
    if (error.response?.status === 401) {      
      // Clear invalid token
      if (localStorage.getItem('authToken')) {
        localStorage.removeItem('authToken');
        delete api.defaults.headers.common['Authorization'];
        console.log('🗑️ Removed invalid token due to 401 error');
      }
      
      if (window.location.pathname !== '/login') {
        navigateTo('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
