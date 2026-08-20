import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '@middlewares/index';
import { uploadChatAttachment } from '@utils/private-storage';
import { ChatController, requireChatAccess } from './chat.controller';
import {
  conversationIdSchema,
  createGroupSchema,
  listMessagesSchema,
  markReadSchema,
  openDirectSchema,
  participantsSchema,
  projectIdSchema,
  renameSchema,
  sendMessageSchema,
} from './chat.validation';

const router = Router();

// Chat is for everyone with an account — clients and studio alike. There is no
// `requireInternal` here on purpose; access is decided per conversation.
router.use(authenticate);

router.get('/conversations', ChatController.listConversations);
router.get('/unread', ChatController.unread);
router.get(
  '/projects/:projectId/people',
  validate({ params: projectIdSchema }),
  ChatController.directory,
);

router.post('/conversations/direct', validate({ body: openDirectSchema }), ChatController.openDirect);
router.post('/conversations/group', validate({ body: createGroupSchema }), ChatController.createGroup);

router.get('/conversations/:id', validate({ params: conversationIdSchema }), ChatController.getConversation);
router.get(
  '/conversations/:id/messages',
  validate({ params: conversationIdSchema, query: listMessagesSchema }),
  ChatController.listMessages,
);

/**
 * `requireChatAccess` runs before the upload middleware: multer streams the
 * file to disk while parsing, so the permission check has to happen first or a
 * stranger's bytes land in someone else's conversation folder.
 */
router.post(
  '/conversations/:id/messages',
  validate({ params: conversationIdSchema }),
  requireChatAccess,
  uploadChatAttachment.array('files', 10),
  validate({ body: sendMessageSchema }),
  ChatController.send,
);

router.post(
  '/conversations/:id/read',
  validate({ params: conversationIdSchema, body: markReadSchema }),
  ChatController.markRead,
);

router.delete(
  '/conversations/:id/messages/:messageId',
  validate({ params: conversationIdSchema.extend({ messageId: z.string().min(1) }) }),
  ChatController.deleteMessage,
);

router.post(
  '/conversations/:id/participants',
  validate({ params: conversationIdSchema, body: participantsSchema }),
  ChatController.addParticipants,
);
router.delete(
  '/conversations/:id/participants/:userId',
  validate({ params: conversationIdSchema.extend({ userId: z.string().min(1) }) }),
  ChatController.removeParticipant,
);
router.post('/conversations/:id/leave', validate({ params: conversationIdSchema }), ChatController.leave);
router.patch(
  '/conversations/:id',
  validate({ params: conversationIdSchema, body: renameSchema }),
  ChatController.rename,
);

router.get(
  '/attachments/:attachmentId',
  validate({ params: z.object({ attachmentId: z.string().min(1) }) }),
  ChatController.download,
);

export default router;
