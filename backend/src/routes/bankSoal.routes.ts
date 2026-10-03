import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  generate,
  list,
  getOne,
  remove,
  exportXlsx,
  createGoogleForm,
} from '../controllers/bankSoal.controller';

const router = Router();

router.use(requireAuth);
router.post('/generate', generate);
router.get('/', list);
router.get('/:id', getOne);
router.get('/:id/export', exportXlsx);
router.post('/:id/google-form', createGoogleForm);
router.delete('/:id', remove);

export default router;