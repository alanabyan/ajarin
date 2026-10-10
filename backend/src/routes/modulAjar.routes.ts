import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { aiQuota } from '../middleware/aiQuota';
import { aiLimiter } from '../middleware/rateLimit';
import { generate, list, getOne, update, remove } from '../controllers/modulAjar.controller';

const router = Router();

router.use(requireAuth);
router.post('/generate', aiLimiter, aiQuota, generate);
router.get('/', list);
router.get('/:id', getOne);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
