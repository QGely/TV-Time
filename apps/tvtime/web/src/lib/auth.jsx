import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, needs_setup: false, allow_registration: true, has_api_key: false });

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/api/auth/me');
      setState({ loading: false, ...data });
    } catch {
      setState((s) => ({ ...s, loading: false, user: null }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => setState((s) => (s.user ? { ...s, user: null } : s));
    window.addEventListener('tvtime:unauthorized', onUnauthorized);
    return () => window.removeEventListener('tvtime:unauthorized', onUnauthorized);
  }, []);

  const login = async (username, password) => {
    const data = await api.post('/api/auth/login', { username, password });
    setState({ loading: false, ...data });
  };
  const register = async (username, password, display_name) => {
    const data = await api.post('/api/auth/register', { username, password, display_name });
    setState({ loading: false, ...data });
  };
  const logout = async () => {
    await api.post('/api/auth/logout');
    setState((s) => ({ ...s, user: null }));
  };
  const setUser = (user) => setState((s) => ({ ...s, user }));

  return <AuthContext.Provider value={{ ...state, refresh, login, register, logout, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
