import { Router } from 'express';
import { z } from 'zod';
import { authenticate, logActivity, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { ClientsController } from './clients.controller';
import {
  clientIdSchema,
  contactSchema,
  createClientSchema,
  listClientsSchema,
  updateClientSchema,
} from './clients.validation';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

const contactParams = z.object({ id: z.string().min(1), contactId: z.string().min(1) });

router.get('/', validate({ query: listClientsSchema }), ClientsController.list);
router.get('/stats', ClientsController.stats);
router.get('/:id', validate({ params: clientIdSchema }), ClientsController.getById);

router.post(
  '/',
  validate({ body: createClientSchema }),
  logActivity('client.create', 'Client'),
  ClientsController.create,
);
router.patch(
  '/:id',
  validate({ params: clientIdSchema, body: updateClientSchema }),
  logActivity('client.update', 'Client'),
  ClientsController.update,
);
router.delete(
  '/:id',
  validate({ params: clientIdSchema }),
  logActivity('client.archive', 'Client'),
  ClientsController.remove,
);

router.post('/:id/contacts', validate({ params: clientIdSchema, body: contactSchema }), ClientsController.addContact);
router.patch(
  '/:id/contacts/:contactId',
  validate({ params: contactParams, body: contactSchema.partial() }),
  ClientsController.updateContact,
);
router.delete('/:id/contacts/:contactId', validate({ params: contactParams }), ClientsController.removeContact);

export default router;
