import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

const StatusContext = createContext({ status: null, refresh: () => {}, setStatus: () => {} });

/** Streak / hearts / XP of the day, shared by the status bar and pages. */
export function StatusProvider({ children }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const s = await api.get('/api/profile/stats');
      const course = user.current_course ? (await api.get('/api/courses').catch(() => [])).find((c) => c.id === user.current_course) : null;
      setStatus({ streak: s.streak, xp_today: s.xp_today, daily_goal: s.daily_goal, hearts: s.hearts, flag: course?.flag, course_id: course?.id });
    } catch {}
  }, [user]);
  useEffect(() => { refresh(); }, [refresh]);
  return <StatusContext.Provider value={{ status, refresh, setStatus }}>{children}</StatusContext.Provider>;
}
export function useStatus() { return useContext(StatusContext); }
