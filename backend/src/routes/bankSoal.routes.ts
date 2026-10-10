import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { aiQuota } from '../middleware/aiQuota';
import { aiLimiter } from '../middleware/rateLimit';
import {
  generate,
  list,
  getOne,
  remove,
  exportXlsx,
  createGoogleForm,
  previewHasilGoogleForm,
} from '../controllers/bankSoal.controller';

const router = Router();

router.use(requireAuth);
router.post('/generate', aiLimiter, aiQuota, generate);
router.get('/', list);
router.get('/:id', getOne);
router.get('/:id/export', exportXlsx);
router.post('/:id/google-form', createGoogleForm);
router.post('/:id/google-form/hasil', previewHasilGoogleForm);
router.delete('/:id', remove);

export default router;