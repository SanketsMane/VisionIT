import { Router } from 'express';
import { authenticate, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { PortfolioController } from './portfolio.controller';
import {
  createPortfolioSchema,
  listPortfolioSchema,
  portfolioIdSchema,
  portfolioSlugSchema,
  publicCatalogSchema,
  updatePortfolioSchema,
} from './portfolio.validation';

const router = Router();

// ── Public. Declared before `authenticate` so the website needs no session. ──
router.get('/public', validate({ query: publicCatalogSchema }), PortfolioController.publicCatalog);
router.get(
  '/public/:slug',
  validate({ params: portfolioSlugSchema }),
  PortfolioController.publicItem,
);

// ── Signed in. Leads reach the same catalog through the portal; the payload is
//    identical, so there is nothing extra to leak. ─────────────────────────────
router.use(authenticate);

router.get('/catalog', validate({ query: publicCatalogSchema }), PortfolioController.publicCatalog);
router.get('/catalog/:slug', validate({ params: portfolioSlugSchema }), PortfolioController.publicItem);

// ── Studio only. ─────────────────────────────────────────────────────────────
router.use(requireInternal);

router.get('/', validate({ query: listPortfolioSchema }), PortfolioController.list);
router.post('/', validate({ body: createPortfolioSchema }), PortfolioController.create);
router.get(
  '/from-project/:id',
  validate({ params: portfolioIdSchema }),
  PortfolioController.draftFromProject,
);
router.get('/:id', validate({ params: portfolioIdSchema }), PortfolioController.getById);
router.patch(
  '/:id',
  validate({ params: portfolioIdSchema, body: updatePortfolioSchema }),
  PortfolioController.update,
);
router.delete('/:id', validate({ params: portfolioIdSchema }), PortfolioController.remove);

export default router;
