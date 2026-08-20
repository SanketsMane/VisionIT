import { z } from 'zod';

export const conversationIdSchema = z.object({ id: z.string().min(1) });
export const projectIdSchema = z.object({ projectId: z.string().min(1) });

export const listConversationsSchema = z.object({
  projectId: z.string().min(1).optional(),
});

export const openDirectSchema = z.object({
  projectId: z.string().min(1, 'Pick a project'),
  userId: z.string().min(1, 'Pick someone to message'),
});

export const createGroupSchema = z.object({
  projectId: z.string().min(1, 'Pick a project'),
  title: z.string().trim().min(2, 'Give the group a name').max(80),
  participantIds: z.array(z.string().min(1)).min(1, 'Add at least one other person').max(50),
});

export const listMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  /** Cursor: the id of the oldest message already held by the client. */
  before: z.string().min(1).optional(),
});

/**
 * Files travel with the message in one multipart request rather than being
 * staged first. A two-step upload would need `Message.id` to be nullable and
 * leave orphan rows whenever someone attached a file and then changed their
 * mind — one request has neither problem, and the browser still gets upload
 * progress because it is still one request.
 */
export const sendMessageSchema = z.object({
  body: z.string().trim().max(8000).optional().nullable(),
  replyToId: z.string().min(1).optional().nullable(),
});

export const markReadSchema = z.object({
  messageId: z.string().min(1).optional(),
});

export const participantsSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(50),
});

export const renameSchema = z.object({
  title: z.string().trim().min(2).max(80),
});

export type CreateGroupDto = z.infer<typeof createGroupSchema>;
export type SendMessageDto = z.infer<typeof sendMessageSchema>;
