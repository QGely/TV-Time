import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { attachUser } from './auth.js';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import exerciseRoutes from './routes/exercises.js';
import programRoutes from './routes/programs.js';
import routineRoutes from './routes/routines.js';
import workoutRoutes from './routes/workouts.js';
import bodyRoutes from './routes/body.js';
import statsRoutes from './routes/stats.js';
import { bundledExercises, bundledPrograms } from './library.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachUser);

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/body', bodyRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));

const distDir = process.env.WEB_DIST || path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: '1d', index: false }));
  app.get(/.*/, (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(distDir, 'index.html')); });
} else {
  app.get('/', (_req, res) => res.type('text').send('Sport API en ligne. Le frontend n’est pas construit (web/dist introuvable).'));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur interne' });
});

app.listen(PORT, () => {
  console.log(`Sport écoute sur http://0.0.0.0:${PORT} — ${bundledExercises().size} exercices, ${bundledPrograms().length} programmes`);
});
