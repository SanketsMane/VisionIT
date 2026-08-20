import fs from 'node:fs';
import type { NextFunction, Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendSuccess } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import { resolvePrivatePath, storageKeyFor } from '@utils/private-storage';
import type { AuthedRequest } from '@/types/common.types';
import { resolveChatAccess } from './chat.access';
import { ChatService } from './chat.service';

/**
 * Verifies conversation access **before** the upload middleware runs.
 *
 * Multer writes the file to disk as it parses the request, so a check inside
 * the controller would happen after a stranger's bytes had already landed in
 * another conversation's folder. Ordering this first makes that impossible.
 */
export const requireChatAccess = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const { user, params } = req as AuthedRequest;
    await resolveChatAccess(user, params.id);
    next();
  },
);

export const ChatController = {
  listConversations: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const projectId = req.query.projectId as string | undefined;
    return sendSuccess(res, await ChatService.listConversations(user, projectId), 'Conversations fetched');
  }),

  unread: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await ChatService.unreadTotal(user), 'Unread counts fetched');
  }),

  directory: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ChatService.directory(user, params.projectId), 'People fetched');
  }),

  openDirect: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const data = await ChatService.openDirect(user, req.body.projectId, req.body.userId);
    return sendSuccess(res, data, 'Conversation ready');
  }),

  createGroup: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const data = await ChatService.createGroup(user, req.body.projectId, {
      title: req.body.title,
      participantIds: req.body.participantIds,
    });
    return sendCreated(res, data, 'Group created');
  }),

  getConversation: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ChatService.getConversation(user, params.id), 'Conversation fetched');
  }),

  listMessages: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { limit, before } = req.query as unknown as { limit: number; before?: string };
    return sendSuccess(res, await ChatService.listMessages(user, params.id, { limit, before }), 'Messages fetched');
  }),

  /**
   * Sends a message, with or without files.
   *
   * Accepts JSON for plain text and multipart when there are attachments; the
   * upload middleware is a no-op on a JSON body, so one route serves both.
   */
  send: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    try {
      const message = await ChatService.sendMessage(user, params.id, {
        body: req.body?.body ?? null,
        replyToId: req.body?.replyToId || null,
        attachments: files.map((file) => ({
          storageKey: storageKeyFor('chat', params.id, file.filename),
          filename: file.originalname,
          mimeType: file.mimetype,
        })),
      });
      return sendCreated(res, message, 'Message sent');
    } catch (error) {
      // The row never got written, so the bytes on disk are litter.
      for (const file of files) {
        fs.promises.unlink(file.path).catch(() => undefined);
      }
      throw error;
    }
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ChatService.markRead(user, params.id, req.body?.messageId), 'Marked as read');
  }),

  deleteMessage: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ChatService.deleteMessage(user, params.id, params.messageId), 'Message deleted');
  }),

  addParticipants: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ChatService.addParticipants(user, params.id, req.body.userIds), 'People added');
  }),

  removeParticipant: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ChatService.removeParticipant(user, params.id, params.userId), 'Person removed');
  }),

  leave: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ChatService.leave(user, params.id), 'You left the group');
  }),

  rename: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ChatService.rename(user, params.id, req.body.title), 'Group renamed');
  }),

  /** Streams an attachment, after proving the caller is in the conversation. */
  download: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const attachment = await ChatService.attachmentFor(user, params.attachmentId);
    const absolute = resolvePrivatePath(attachment.storageKey);

    if (!fs.existsSync(absolute)) throw ApiError.notFound('File');

    res.setHeader('Content-Type', attachment.mimeType);
    // Images and video are previewed inline; anything else downloads.
    const inline = /^(image|video|audio)\//.test(attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(attachment.filename)}"`,
    );
    // Private, but immutable once written — safe for the browser to keep.
    res.setHeader('Cache-Control', 'private, max-age=86400');
    fs.createReadStream(absolute).pipe(res);
  }),
};

export default ChatController;
