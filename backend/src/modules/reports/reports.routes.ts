import { Router } from 'express';
import { authenticate, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { ReportsController } from './reports.controller';
import { asOfSchema, monthlySchema, periodSchema, trendSchema } from './reports.validation';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

router.get('/profit-loss', validate({ query: periodSchema }), ReportsController.profitAndLoss);
router.get('/balance-sheet', validate({ query: asOfSchema }), ReportsController.balanceSheet);
router.get('/cash-flow', validate({ query: periodSchema }), ReportsController.cashFlow);
router.get('/trial-balance', validate({ query: asOfSchema }), ReportsController.trialBalance);
router.get('/tax-summary', validate({ query: periodSchema }), ReportsController.taxSummary);
router.get('/monthly', validate({ query: monthlySchema }), ReportsController.monthly);
router.get('/monthly-pack', validate({ query: monthlySchema }), ReportsController.monthlyPack);
router.get('/trend', validate({ query: trendSchema }), ReportsController.trend);

export default router;
