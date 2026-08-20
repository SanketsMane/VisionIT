import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { LeadsController } from './leads.controller';
import {
  contactSchema,
  leadIdSchema,
  leadRegisterSchema,
  listLeadsSchema,
  updateLeadSchema,
} from './leads.validation';

const router = Router();

/**
 * Tighter than the general API limit and keyed by IP.
 *
 * Sign-up and the contact form are the only unauthenticated writes on the
 * platform, which makes them the obvious targets for scripted abuse.
 *
 * The limit is deliberately not as low as it could be. Indian mobile carriers
 * put thousands of subscribers behind one CGNAT address, so a handful per hour
 * would lock out real people who happen to share an IP with someone who signed
 * up earlier. Fifteen still stops a script — a bot attempts hundreds — while
 * leaving room for a shared address.
 */
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-up attempts. Please try again later.' },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages sent. Please try again later.' },
});

// ── Public. No session, and no path here can create anything but a LEAD. ─────
router.post(
  '/register',
  signupLimiter,
  validate({ body: leadRegisterSchema }),
  LeadsController.register,
);
router.post('/contact', contactLimiter, validate({ body: contactSchema }), LeadsController.contact);

// ── Studio only. ─────────────────────────────────────────────────────────────
router.use(authenticate, requireInternal);

router.get('/', validate({ query: listLeadsSchema }), LeadsController.list);
router.get('/stats', LeadsController.stats);
router.get('/enquiries', LeadsController.enquiries);
router.post(
  '/enquiries/:id/read',
  validate({ params: leadIdSchema }),
  LeadsController.markEnquiryRead,
);
router.get('/:id', validate({ params: leadIdSchema }), LeadsController.getById);
router.patch(
  '/:id',
  validate({ params: leadIdSchema, body: updateLeadSchema }),
  LeadsController.update,
);

export default router;
