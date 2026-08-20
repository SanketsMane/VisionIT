import { Router } from 'express';
import { aiLimiter, authenticate, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { AiController } from './ai.controller';
import {
  generateEmailSchema,
  historySchema,
  improveEmailSchema,
  subjectSuggestSchema,
  usageSchema,
} from './ai.validation';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

router.get('/options', AiController.options);
router.get('/history', validate({ query: historySchema }), AiController.history);
router.get('/usage', validate({ query: usageSchema }), AiController.usage);

// Every generation endpoint sits behind the tighter AI bucket — these calls
// cost money per request, unlike ordinary reads.
router.post('/email/generate', aiLimiter, validate({ body: generateEmailSchema }), AiController.generateEmail);
router.post('/email/improve', aiLimiter, validate({ body: improveEmailSchema }), AiController.improveEmail);
router.post('/email/subjects', aiLimiter, validate({ body: subjectSuggestSchema }), AiController.suggestSubjects);

export default router;
