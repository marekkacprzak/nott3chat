export type AccessTokenState = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
};

const ACCESS_TOKEN_KEY = 'auth.accessTokenState';
const SIGNALR_TOKEN_KEY = 'auth.signalRTokenState';

export const isIos = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
};

const read = <T>(key: string): T | undefined => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const remove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

export const setAccessTokenState = (state: AccessTokenState | undefined) => {
  if (!isIos()) return; // Only persist for iOS path
  if (!state) {
    remove(ACCESS_TOKEN_KEY);
    return;
  }
  write(ACCESS_TOKEN_KEY, state);
};

export const getAccessTokenState = (): AccessTokenState | undefined => {
  if (!isIos()) return undefined;
  const state = read<AccessTokenState>(ACCESS_TOKEN_KEY);
  if (!state) return undefined;
  if (state.expiresAt && Date.now() >= state.expiresAt) {
    // expired
    remove(ACCESS_TOKEN_KEY);
    return undefined;
  }
  return state;
};

export const clearTokens = () => {
  remove(ACCESS_TOKEN_KEY);
  remove(SIGNALR_TOKEN_KEY);
};

export type SignalRTokenState = {
  accessToken: string;
  expiresAt?: number; // epoch ms
};

// Non-iOS: keep SignalR token only in memory to avoid XSS risks of localStorage
let volatileSignalRToken: SignalRTokenState | undefined;

export const setSignalRTokenState = (state: SignalRTokenState | undefined) => {
  if (isIos()) {
    if (!state) {
      remove(SIGNALR_TOKEN_KEY);
      return;
    }
    write(SIGNALR_TOKEN_KEY, state);
  } else {
    // Non-iOS: store in memory only
    volatileSignalRToken = state;
  }
};

export const getSignalRToken = (): string | undefined => {
  if (isIos()) {
    const state = read<SignalRTokenState>(SIGNALR_TOKEN_KEY);
    if (!state) return undefined;
    if (state.expiresAt && Date.now() >= state.expiresAt) {
      remove(SIGNALR_TOKEN_KEY);
      return undefined;
    }
    return state.accessToken;
  }
  // Non-iOS: use volatile token
  const v = volatileSignalRToken;
  if (!v) return undefined;
  if (v.expiresAt && Date.now() >= v.expiresAt) {
    volatileSignalRToken = undefined;
    return undefined;
  }
  return v.accessToken;
};
