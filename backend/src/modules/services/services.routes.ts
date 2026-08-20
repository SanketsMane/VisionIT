import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { ServicesController } from './services.controller';
import {
  couponFields,
  couponPreviewSchema,
  createServiceSchema,
  listQuotesSchema,
  listServicesSchema,
  quoteRequestSchema,
  reorderServicesSchema,
  serviceIdSchema,
  serviceSlugSchema,
  updateCouponSchema,
  updateQuoteSchema,
  updateServiceSchema,
} from './services.validation';

const router = Router();

/**
 * The enquiry form is reachable without a session, so it gets its own limit —
 * generous enough for a real person who mistypes an email twice, tight enough
 * that the inbox cannot be flooded from one address.
 */
const quoteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many enquiries from this address. Please try again later.' },
});

const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Higher than the enquiry limit because trying a few codes is normal, but
  // low enough that the endpoint cannot be used to brute-force valid ones.
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait a moment.' },
});

// ── Public. Declared before `authenticate` so no session is required. ───────
router.get('/public', ServicesController.publicCatalog);
router.get('/public/:slug', validate({ params: serviceSlugSchema }), ServicesController.publicService);
router.post('/public/coupon', couponLimiter, validate({ body: couponPreviewSchema }), ServicesController.previewCoupon);
router.post('/public/quote', quoteLimiter, validate({ body: quoteRequestSchema }), ServicesController.submitQuote);

// ── Studio ─────────────────────────────────────────────────────────────────
router.use(authenticate);
router.use(requireInternal);

router.get('/', validate({ query: listServicesSchema }), ServicesController.list);
router.get('/stats', ServicesController.stats);

router.get('/quotes', validate({ query: listQuotesSchema }), ServicesController.listQuotes);
router.get('/quotes/:id', validate({ params: serviceIdSchema }), ServicesController.getQuote);
router.patch('/quotes/:id', validate({ params: serviceIdSchema, body: updateQuoteSchema }), ServicesController.updateQuote);

router.get('/coupons', ServicesController.listCoupons);
router.post('/coupons', validate({ body: couponFields }), ServicesController.createCoupon);
router.patch('/coupons/:id', validate({ params: serviceIdSchema, body: updateCouponSchema }), ServicesController.updateCoupon);
router.delete('/coupons/:id', validate({ params: serviceIdSchema }), ServicesController.removeCoupon);

router.post('/reorder', validate({ body: reorderServicesSchema }), ServicesController.reorder);

// Declared last so `/stats`, `/quotes` and `/coupons` are not swallowed by `:id`.
router.post('/', validate({ body: createServiceSchema }), ServicesController.create);
router.get('/:id', validate({ params: serviceIdSchema }), ServicesController.getById);
router.patch('/:id', validate({ params: serviceIdSchema, body: updateServiceSchema }), ServicesController.update);
router.delete('/:id', validate({ params: serviceIdSchema }), ServicesController.remove);

export default router;
