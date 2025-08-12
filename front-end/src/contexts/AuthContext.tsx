import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import api from '../services/api';
import {
  isIos,
  setAccessTokenState,
  getAccessTokenState,
  clearTokens,
  setSignalRTokenState,
} from '../services/tokenStore.ts';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;

  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  checkAuth: () => Promise<void>;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* eslint-disable react-refresh/only-export-components */
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

  const fetchSignalRToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await api.post('/signalr-token');
      if (response.data?.success) {
        const accessToken: string | undefined = response.data?.accessToken;
        const expiresIn = response.data?.expiresIn as number | undefined;
        if (accessToken) {
          // Store for all platforms: iOS -> localStorage; non-iOS -> in-memory
          setSignalRTokenState({
            accessToken,
            expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
          });
          console.debug('✅ SignalR token received', {
            mode: isIos() ? 'iOS-header' : 'desktop-header+cookie',
          });
        }
        if (!isIos()) {
          console.debug('✅ SignalR token also secured in httpOnly cookie');
        }
        return true;
      }
    } catch (error) {
      console.error('❌ Failed to get secure SignalR token:', error);
    }
    return false;
  }, []);

  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      // Check authentication
      if (isIos()) {
        const state = getAccessTokenState();
        if (!state?.accessToken) throw new Error('No token');
        await api.get('/manage/info');
      } else {
        // Cookie-based
        await api.get('/manage/info');
      }
      // Ensure we have SignalR token for chat functionality before marking authenticated
      await fetchSignalRToken();
      setIsAuthenticated(true);

      console.debug('✅ Dual-token authentication check successful');
    } catch (error) {
      const axiosError = error as { response?: { status?: number } };
      console.debug(
        '⚠️ Authentication check failed:',
        axiosError?.response?.status
      );
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [fetchSignalRToken]);

  const login = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        if (isIos()) {
          // Use token-based login for iOS
          const response = await api.post('/login', { email, password });
          if (response.status === 200 && response.data?.accessToken) {
            const { accessToken, refreshToken, expiresIn } = response.data;
            const expiresAt = expiresIn
              ? Date.now() + expiresIn * 1000
              : undefined;
            setAccessTokenState({ accessToken, refreshToken, expiresAt });
            // Fetch SignalR token before setting authenticated to ensure connection starts with token
            await fetchSignalRToken();
            setIsAuthenticated(true);
            return { success: true };
          }
          throw new Error('Login failed');
        }

        // Non-iOS: cookie-based
        const response = await api.post('/login?useCookies=true', {
          email,
          password,
        });

        if (response.status === 200) {
          // Get SignalR token first so connection starts with header/cookie present
          await fetchSignalRToken();
          setIsAuthenticated(true);
          console.debug('✅ Dual-token authentication successful');
          return { success: true };
        } else {
          throw new Error('Login failed');
        }
      } catch (error) {
        console.error('❌ Authentication failed:', error);

        let errorMessage: string;
        const axiosError = error as {
          response?: { status?: number; data?: { message?: string } };
        };
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
    },
    [fetchSignalRToken]
  );

  const register = useCallback(
    async (
      username: string,
      email: string,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await api.post('/register-user', {
          username: username,
          userEmail: email,
          password: password,
        });
        // After successful registration, log the user in
        const loginResult = await login(email, password);
        return loginResult;
      } catch (error) {
        const axiosError = error as {
          response?: { data?: { message?: string; title?: string } };
        };
        return {
          success: false,
          error:
            axiosError.response?.data?.message ||
            axiosError.response?.data?.title ||
            'Registration failed',
        };
      }
    },
    [login]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (isIos()) {
        clearTokens();
      } else {
        await api.post('/logout', {}, { withCredentials: true });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear authentication state (cookies handled by server)
      setIsAuthenticated(false);
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
