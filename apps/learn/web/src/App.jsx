import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { StatusProvider } from './lib/status.jsx';
import { ToastProvider } from './lib/toast.jsx';
import { Layout } from './components/Layout.jsx';
import { Spinner } from './components/Misc.jsx';
import { Login } from './pages/Login.jsx';
import { Path } from './pages/Path.jsx';
import { Courses, SkillDetail } from './pages/Courses.jsx';
import { Lesson } from './pages/Lesson.jsx';
import { Practice } from './pages/Practice.jsx';
import { Leaderboard } from './pages/Leaderboard.jsx';
import { Profile } from './pages/Profile.jsx';
import { Settings } from './pages/Settings.jsx';

function ScrollToTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [pathname]); return null; }

function Gate() {
  const { loading, user } = useAuth();
  if (loading) return <div className="auth"><Spinner /></div>;
  if (!user) return <Login />;
  return (
    <StatusProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Path />} />
          <Route path="courses" element={<Courses />} />
          <Route path="skill/:courseId/:skillId" element={<SkillDetail />} />
          <Route path="lesson/:courseId/:skillId" element={<Lesson />} />
          <Route path="practice" element={<Practice />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </StatusProvider>
  );
}

export default function App() {
  return (<BrowserRouter><ScrollToTop /><ToastProvider><AuthProvider><Gate /></AuthProvider></ToastProvider></BrowserRouter>);
}
