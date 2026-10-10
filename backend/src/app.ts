import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/errors';
import auth from './modules/auth';
import dampak from './modules/dampak';
import kelas from './modules/kelas';
import modul from './modules/modul';
import soal from './modules/soal';

const app = express();

// Di belakang proxy Vercel; dibutuhkan agar rate limit membaca IP klien yang benar.
app.set('trust proxy', 1);
app.use(helmet());

const origin = ['http://localhost:5173', ...(process.env.CLIENT_URL ?? '').split(',').map((s) => s.trim().replace(/\/$/, ''))].filter(Boolean);
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', auth);
app.use('/api/modul', modul);
app.use('/api/soal', soal);
app.use('/api/kelas', kelas);
app.use('/api/dampak', dampak);

app.use((_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));
app.use(errorHandler);

export default app;
