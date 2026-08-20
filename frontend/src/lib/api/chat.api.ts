import { api, del, get, patch, post } from './client';

export type ConversationType = 'DIRECT' | 'GROUP';
export type ParticipantRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type MessageType = 'TEXT' | 'FILE' | 'IMAGE' | 'SYSTEM';

export interface ChatPerson {
  id: string;
  name: string;
  email?: string;
  avatarUrl: string | null;
  userType: 'INTERNAL' | 'CLIENT';
  projectRole?: string | null;
  role?: ParticipantRole;
}

export interface ChatAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  type: MessageType;
  body: string | null;
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl: string | null; userType: string } | null;
  attachments: ChatAttachment[];
  replyTo: {
    id: string; body: string | null; type: MessageType;
    sender: { id: string; name: string } | null;
  } | null;
}

export interface ConversationSummary {
  id: string;
  projectId: string;
  project: { id: string; title: string; code: string | null };
  type: ConversationType;
  title: string;
  avatarUrl: string | null;
  participants: ChatPerson[];
  participantCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageIsMine: boolean;
  unreadCount: number;
  isMuted: boolean;
  myRole: ParticipantRole;
}

export interface ConversationDetail extends Omit<ConversationSummary, 'unreadCount' | 'isMuted' | 'lastMessageIsMine' | 'participantCount'> {
  createdById: string;
  canManage: boolean;
  participants: (ChatPerson & { joinedAt: string; lastReadAt: string | null })[];
}

export interface MessagePage {
  items: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
  /** Everyone else's read marks, for drawing the ticks. */
  receipts: { userId: string; lastReadAt: string | null; lastDeliveredAt: string | null }[];
}

export const chatApi = {
  conversations: (projectId?: string) =>
    get<ConversationSummary[]>('/chat/conversations', { params: projectId ? { projectId } : {} }),

  unread: () => get<{ total: number; byConversation: { conversationId: string; unreadCount: number }[] }>('/chat/unread'),

  people: (projectId: string) => get<ChatPerson[]>(`/chat/projects/${projectId}/people`),

  openDirect: (projectId: string, userId: string) =>
    post<ConversationDetail>('/chat/conversations/direct', { projectId, userId }),

  createGroup: (payload: { projectId: string; title: string; participantIds: string[] }) =>
    post<ConversationDetail>('/chat/conversations/group', payload),

  conversation: (id: string) => get<ConversationDetail>(`/chat/conversations/${id}`),

  messages: (id: string, params: { limit?: number; before?: string } = {}) =>
    get<MessagePage>(`/chat/conversations/${id}/messages`, { params }),

  /**
   * Text goes as JSON; anything with files goes as multipart in the same
   * request, so the browser reports real upload progress for one operation.
   */
  async send(
    id: string,
    payload: { body?: string; replyToId?: string | null; files?: File[] },
    onProgress?: (percent: number) => void,
  ) {
    const hasFiles = Boolean(payload.files?.length);
    if (!hasFiles) {
      return post<ChatMessage>(`/chat/conversations/${id}/messages`, {
        body: payload.body ?? '',
        replyToId: payload.replyToId ?? null,
      });
    }

    const form = new FormData();
    if (payload.body) form.append('body', payload.body);
    if (payload.replyToId) form.append('replyToId', payload.replyToId);
    for (const file of payload.files ?? []) form.append('files', file);

    const response = await api.post<{ data: ChatMessage }>(
      `/chat/conversations/${id}/messages`,
      form,
      {
        // Letting the browser set it keeps the multipart boundary intact.
        headers: { 'Content-Type': undefined } as never,
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      },
    );
    return response.data.data;
  },

  markRead: (id: string, messageId?: string) =>
    post<{ lastReadAt: string | null }>(`/chat/conversations/${id}/read`, { messageId }),

  deleteMessage: (id: string, messageId: string) =>
    del<{ deleted: boolean }>(`/chat/conversations/${id}/messages/${messageId}`),

  addPeople: (id: string, userIds: string[]) =>
    post<ConversationDetail>(`/chat/conversations/${id}/participants`, { userIds }),

  removePerson: (id: string, userId: string) =>
    del<ConversationDetail>(`/chat/conversations/${id}/participants/${userId}`),

  leave: (id: string) => post<{ left: boolean }>(`/chat/conversations/${id}/leave`),

  rename: (id: string, title: string) => patch<ConversationDetail>(`/chat/conversations/${id}`, { title }),

  /** Attachments are private — this is the only way to reach one. */
  attachmentUrl: (attachmentId: string) => `/chat/attachments/${attachmentId}`,
};
