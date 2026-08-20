import { Router } from 'express';
import { z } from 'zod';
import { authenticate, uploadDocument, uploadImage, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { UploadsController } from './uploads.controller';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

router.get('/', UploadsController.list);
router.post('/image', uploadImage.single('file'), UploadsController.single);
router.post('/document', uploadDocument.single('file'), UploadsController.single);
router.post('/gallery', uploadImage.array('files', 20), UploadsController.multiple);
router.delete('/:id', validate({ params: z.object({ id: z.string().min(1) }) }), UploadsController.remove);

export default router;
