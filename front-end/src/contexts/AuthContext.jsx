import PropTypes from 'prop-types';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      // Check if we have a stored token (for mobile devices)
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        console.log('🔧 Using stored token for authentication');
      } else {
        console.log('🍪 No stored token - using cookie-based authentication');
      }
      
      await api.get('/manage/info');
      setIsAuthenticated(true);
      console.log('✅ Authentication check successful');
    } catch (error) {
      console.warn('⚠️ Authentication check failed:', error?.response?.status);
      
      // If token auth fails, remove the invalid token
      if (localStorage.getItem('authToken')) {
        localStorage.removeItem('authToken');
        delete api.defaults.headers.common['Authorization'];
        console.log('🗑️ Removed invalid token');
      }
      
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    // Use token-based authentication as primary method (no mobile detection)
    console.info('� Using token-based authentication as primary method');
    try {
      const tokenResponse = await api.post('/login?useCookies=false', { email, password });
      
      if (tokenResponse.data?.accessToken) {
        // Store the token for future requests
        localStorage.setItem('authToken', tokenResponse.data.accessToken);
        
        // Add token to default headers for future requests
        api.defaults.headers.common['Authorization'] = `Bearer ${tokenResponse.data.accessToken}`;
        
        setIsAuthenticated(true);
        console.log('✅ Token-based authentication successful');
        return { success: true };
      } else {
        console.error('❌ Token response missing accessToken:', tokenResponse.data);
        throw new Error('Token not received from server');
      }
    } catch (error) {
      console.error('❌ Token-based authentication failed:', error);
      
      let errorMessage;
      if (!error.response) {
        errorMessage = 'Server currently not available';
      } else if (error.response?.status === 404) {
        errorMessage = 'Server currently not available';
      } else {
        errorMessage = error.response?.data?.message || 'Login failed';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  const register = useCallback(async (username, email, password) => {
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
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.title || 'Registration failed',
      };
    }
  }, [login]);

  const logout = useCallback(async () => {
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
        console.log('🗑️ Cleared stored auth token');
      }
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value = {
    isAuthenticated,
    loading,
    login,
    logout,
    register,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
