import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { navigateTo } from './navigationService';
import { getAccessTokenState, setAccessTokenState, isIos } from './tokenStore.ts';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: !isIos(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization header for iOS header-based auth
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isIos()) {
    const state = getAccessTokenState();
    if (state?.accessToken) {
      config.headers = config.headers || {};
      (config.headers as any)['Authorization'] = `Bearer ${state.accessToken}`;
      console.debug('[Auth][REQ] iOS attaching Authorization header', {
        url: config.url,
        method: config.method,
      });
    }
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    if (error?.config?.url && error.config.url !== '/manage/info')
    console.error('🚨 API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      withCredentials: error.config?.withCredentials,
      headers: error.response?.headers
    });
    
    // Try refresh once for iOS token mode
    if (isIos() && error.response?.status === 401 && (error.config as any)?._retry !== true) {
      const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      original._retry = true;
      const existing = getAccessTokenState();
      if (existing?.refreshToken) {
        console.debug('[Auth][401] iOS attempting token refresh', { url: original.url });
        try {
          const resp = await api.post('/refresh', { refreshToken: existing.refreshToken });
          const { accessToken, refreshToken, expiresIn } = resp.data || {};
          if (accessToken) {
            const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
            setAccessTokenState({ accessToken, refreshToken, expiresAt });
            console.info('[Auth] Refresh succeeded, retrying original request', { url: original.url });
            // retry original
            return api(original);
          }
        } catch (e) {
          console.error('[Auth] Refresh failed', e);
          // fall through to redirect
        }
      }
    }

    if (error.response?.status === 401) {      
      // Authentication failed - cookies handled by server
      console.debug('[Auth][401] Unauthenticated, redirecting to /login', { url: error.config?.url });
      if (window.location.pathname !== '/login') {
        navigateTo('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
