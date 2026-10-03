import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import modulAjarRoutes from './routes/modulAjar.routes';
import bankSoalRoutes from './routes/bankSoal.routes';
import siswaRoutes from './routes/siswa.routes';
import nilaiRoutes from './routes/nilai.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors({ 
  origin: [
    'http://localhost:5173', 
    'https://ajarin-self.vercel.app/',
    process.env.CLIENT_URL || ''
  ],
  credentials: true
}));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/modul-ajar', modulAjarRoutes);
app.use('/api/bank-soal', bankSoalRoutes);
app.use('/api', siswaRoutes);
app.use('/api/nilai', nilaiRoutes);

app.use(errorHandler);

export default app;
