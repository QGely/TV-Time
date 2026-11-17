import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, needs_setup: false, allow_registration: true });
  const refresh = useCallback(async () => {
    try { setState({ loading: false, ...(await api.get('/api/auth/me')) }); } catch { setState((s) => ({ ...s, loading: false, user: null })); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => setState((s) => (s.user ? { ...s, user: null } : s));
    window.addEventListener('learn:unauthorized', h);
    return () => window.removeEventListener('learn:unauthorized', h);
  }, []);
  const login = async (username, password) => setState({ loading: false, ...(await api.post('/api/auth/login', { username, password })) });
  const register = async (username, password, display_name) => setState({ loading: false, ...(await api.post('/api/auth/register', { username, password, display_name })) });
  const logout = async () => { await api.post('/api/auth/logout'); setState((s) => ({ ...s, user: null })); };
  const setUser = (user) => setState((s) => ({ ...s, user }));
  return <AuthContext.Provider value={{ ...state, refresh, login, register, logout, setUser }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
