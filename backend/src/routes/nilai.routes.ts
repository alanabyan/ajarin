import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { createNilai, createNilaiBatch, removeNilai, rekapByKelas } from '../controllers/nilai.controller';

const router = Router();

router.use(requireAuth);
router.post('/', createNilai);
router.post('/batch', createNilaiBatch);
router.get('/rekap/:kelasId', rekapByKelas);
router.delete('/:id', removeNilai);

export default router;