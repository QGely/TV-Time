import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { attachUser } from './auth.js';
import { refreshFollowedShows } from './sync.js';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import discoverRoutes from './routes/discover.js';
import showRoutes from './routes/shows.js';
import movieRoutes from './routes/movies.js';
import libraryRoutes from './routes/library.js';
import profileRoutes from './routes/profile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachUser);

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));

// Serve the built frontend (web/dist) if present.
const distDir = process.env.WEB_DIST || path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: '1d', index: false }));
  app.get(/.*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => res.type('text').send('TV Time API en ligne. Le frontend n’est pas construit (web/dist introuvable).'));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur interne' });
});

app.listen(PORT, () => {
  console.log(`TV Time écoute sur http://0.0.0.0:${PORT}`);
});

// Periodic refresh of followed shows (new episodes, air dates).
const REFRESH_MS = (Number(process.env.REFRESH_HOURS) || 6) * 3600e3;
setTimeout(() => refreshFollowedShows().catch((e) => console.error('[refresh]', e.message)), 60e3);
setInterval(() => refreshFollowedShows().catch((e) => console.error('[refresh]', e.message)), REFRESH_MS);
