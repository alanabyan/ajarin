import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { createKelas, listKelas, removeKelas, createSiswa, removeSiswa } from '../controllers/siswa.controller';
import {
  unggahFile,
  parseImport,
  bulkCreateSiswa,
  unduhTemplate,
} from '../controllers/siswaImport.controller';
 
const router = Router();
 
router.use(requireAuth);
router.post('/kelas', createKelas);
router.get('/kelas', listKelas);
router.delete('/kelas/:id', removeKelas);
router.post('/siswa', createSiswa);
router.delete('/siswa/:id', removeSiswa);
 
// Impor siswa dari Excel / CSV / foto
router.get('/siswa/template', unduhTemplate);
router.post('/siswa/import/parse', unggahFile, parseImport);
router.post('/siswa/bulk', bulkCreateSiswa);
 
export default router;