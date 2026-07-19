import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { getToken, setToken as saveToken, clearToken } from './api';
import { decodeJwt, isTokenValid } from './auth';

interface AuthState {
  token: string | null;
  username: string | null;
  role: 'admin' | 'viewer' | null;
  isAuthenticated: boolean;
  login: (token: string, username: string, role: 'admin' | 'viewer') => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = getToken();
  const validInitial = isTokenValid(initial) ? initial : null;
  const [token, setTokenState] = useState<string | null>(validInitial);
  const payload = token ? decodeJwt(token) : null;
  const [usernameOverride, setUsernameOverride] = useState<string | null>(null);

  const login = (newToken: string, username: string, role: 'admin' | 'viewer') => {
    saveToken(newToken);
    setTokenState(newToken);
    setUsernameOverride(username);
    void role;
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setUsernameOverride(null);
  };

  const value = useMemo<AuthState>(
    () => ({
      token,
      username: usernameOverride || payload?.sub || null,
      role: payload?.role || null,
      isAuthenticated: !!token,
      login,
      logout,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, usernameOverride]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider');
  return ctx;
}
