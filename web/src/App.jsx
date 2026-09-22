import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { ToastProvider } from './lib/toast.jsx';
import { Layout } from './components/Layout.jsx';
import { Spinner } from './components/Misc.jsx';
import { Login } from './pages/Login.jsx';
import { Home } from './pages/Home.jsx';
import { Explore } from './pages/Explore.jsx';
import { Show } from './pages/Show.jsx';
import { Movie } from './pages/Movie.jsx';
import { Library } from './pages/Library.jsx';
import { Calendar } from './pages/Calendar.jsx';
import { Profile } from './pages/Profile.jsx';
import { Settings } from './pages/Settings.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Gate() {
  const { loading, user } = useAuth();
  if (loading) return <div className="auth"><Spinner /></div>;
  if (!user) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="show/:id" element={<Show />} />
        <Route path="movie/:id" element={<Movie />} />
        <Route path="library" element={<Library />} />
        <Route path="movies" element={<Navigate to="/library?kind=movies" replace />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
