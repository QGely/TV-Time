import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { ToastProvider } from './lib/toast.jsx';
import { Layout } from './components/Layout.jsx';
import { Spinner } from './components/Misc.jsx';
import { Login } from './pages/Login.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Exercises, ExerciseDetail } from './pages/Exercises.jsx';
import { Programs, ProgramDetail } from './pages/Programs.jsx';
import { Routines, RoutineEditor } from './pages/Routines.jsx';
import { Workout } from './pages/Workout.jsx';
import { History } from './pages/History.jsx';
import { Stats } from './pages/Stats.jsx';
import { Settings } from './pages/Settings.jsx';

function ScrollToTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [pathname]); return null; }

function Gate() {
  const { loading, user } = useAuth();
  if (loading) return <div className="auth"><Spinner /></div>;
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="exercises" element={<Exercises />} />
        <Route path="exercises/:id" element={<ExerciseDetail />} />
        <Route path="programs" element={<Programs />} />
        <Route path="programs/:id" element={<ProgramDetail />} />
        <Route path="routines" element={<Routines />} />
        <Route path="routines/new" element={<RoutineEditor />} />
        <Route path="routines/:id/edit" element={<RoutineEditor />} />
        <Route path="workout/:id" element={<Workout />} />
        <Route path="workouts/:id" element={<Workout />} />
        <Route path="history" element={<History />} />
        <Route path="stats" element={<Stats />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (<BrowserRouter><ScrollToTop /><ToastProvider><AuthProvider><Gate /></AuthProvider></ToastProvider></BrowserRouter>);
}
