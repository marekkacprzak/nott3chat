import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
   
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
   
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  checkAuth: () => Promise<void>;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSignalRToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await api.post('/signalr-token');
      if (response.data?.token) {
        localStorage.setItem('signalRToken', response.data.token);
        return response.data.token;
      }
    } catch (error) {
      console.error('❌ Failed to get SignalR token:', error);
    }
    return null;
  }, []);

  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      // Check if we have a stored token (for mobile devices)
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }
      
      await api.get('/manage/info');
      setIsAuthenticated(true);
      
      // Get SignalR token if we don't have one
      if (!localStorage.getItem('signalRToken')) {
        await fetchSignalRToken();
      }
      
      console.log('✅ Authentication check successful');
    } catch (error) {  
      //console.warn('⚠️ Authentication check failed:', error?.response?.status);
      
      // If token auth fails, remove the invalid token
      if (localStorage.getItem('authToken')) {
        localStorage.removeItem('authToken');
        delete api.defaults.headers.common['Authorization'];
        console.log('🗑️ Removed invalid token');
      }
      
      // Also remove SignalR token if auth fails
      if (localStorage.getItem('signalRToken')) {
        localStorage.removeItem('signalRToken');
        console.log('🗑️ Removed invalid SignalR token');
      }
      
      //setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [fetchSignalRToken]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Use token-based authentication as primary method (no mobile detection)
    try {
      const tokenResponse = await api.post('/login?useCookies=false', { email, password });
      
      if (tokenResponse.data?.accessToken) {
        // Store the token for future requests
        localStorage.setItem('authToken', tokenResponse.data.accessToken);
        
        // Add token to default headers for future requests
        api.defaults.headers.common['Authorization'] = `Bearer ${tokenResponse.data.accessToken}`;
        
        // Get SignalR JWT token
        await fetchSignalRToken();
        
        setIsAuthenticated(true);

        return { success: true };
      } else {
        console.error('❌ Token response missing accessToken:', tokenResponse.data);
        throw new Error('Token not received from server');
      }
    } catch (error) {
      console.error('❌ Token-based authentication failed:', error);
      
      let errorMessage: string;
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } };
      if (!axiosError.response) {
        errorMessage = 'Server currently not available';
      } else if (axiosError.response?.status === 404) {
        errorMessage = 'Server currently not available';
      } else {
        errorMessage = axiosError.response?.data?.message || 'Login failed';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [fetchSignalRToken]);

  const register = useCallback(async (username: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post('/register-user', { 
        username: username,
        userEmail: email, 
        password: password 
      });
      // After successful registration, log the user in
      const loginResult = await login(email, password);
      return loginResult;
    } catch (error) {
      const axiosError = error as { response?: { data?: { message?: string; title?: string } } };
      return {
        success: false,
        error: axiosError.response?.data?.message || axiosError.response?.data?.title || 'Registration failed',
      };
    }
  }, [login]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear both cookie and token authentication
      setIsAuthenticated(false);
      
      // Remove stored token if it exists
      if (localStorage.getItem('authToken')) {
        localStorage.removeItem('authToken');
        delete api.defaults.headers.common['Authorization'];
      }
      
      // Remove SignalR token if it exists
      if (localStorage.getItem('signalRToken')) {
        localStorage.removeItem('signalRToken');
      }
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value: AuthContextType = {
    isAuthenticated,
    loading,
    login,
    logout,
    register,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
