import { ParticipantRole, UserType } from '@prisma/client';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { resolveProjectAccess } from '@middlewares/project-access.middleware';

/**
 * Who may see and do what inside a conversation.
 *
 * Every chat route and every socket event funnels through here. The rule has
 * two halves, and both must hold:
 *
 *   1. The user still has access to the conversation's **project** — the same
 *      `User → Membership → Project` check the rest of the portal uses. Losing
 *      project membership must close the thread too, otherwise removing someone
 *      from a project would leave them reading its chat forever.
 *   2. The user is an **active participant** of the conversation — a project
 *      member is not automatically in every group inside it.
 *
 * Failures are 404, never 403: telling someone a conversation exists but is off
 * limits is itself a leak, and conversation ids would become enumerable.
 */
export interface ChatAccess {
  conversationId: string;
  projectId: string;
  participantId: string;
  role: ParticipantRole;
  isInternal: boolean;
  /** Group admins and owners may rename, add and remove. */
  canManage: boolean;
}

export const resolveChatAccess = async (
  user: Express.AuthenticatedUser,
  conversationId: string,
): Promise<ChatAccess> => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, projectId: true, type: true },
  });
  if (!conversation) throw ApiError.notFound('Conversation');

  // Throws 404 of its own if the project is gone or not theirs.
  await resolveProjectAccess(user, conversation.projectId);

  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    select: { id: true, role: true, leftAt: true },
  });

  if (!participant || participant.leftAt) throw ApiError.notFound('Conversation');

  const isInternal = user.userType === UserType.INTERNAL;

  return {
    conversationId,
    projectId: conversation.projectId,
    participantId: participant.id,
    role: participant.role,
    isInternal,
    // The studio can always manage a thread inside its own project; a client
    // manages only the groups they created or were promoted in.
    canManage:
      isInternal ||
      participant.role === ParticipantRole.OWNER ||
      participant.role === ParticipantRole.ADMIN,
  };
};

/**
 * The set of users who may legitimately be added to a project's conversations.
 *
 * Both sides: the workspace owner and internal members, plus active client
 * members. Anyone not in this list cannot be added, which is what stops a
 * client inviting an outsider into a thread about someone else's project.
 */
export const eligibleParticipants = async (projectId: string) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) throw ApiError.notFound('Project');

  const [owner, members] = await Promise.all([
    prisma.user.findFirst({
      where: { id: project.userId, isActive: true },
      select: { id: true, name: true, email: true, avatarUrl: true, userType: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId, isActive: true, user: { isActive: true } },
      select: {
        role: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true, userType: true } },
      },
    }),
  ]);

  const seen = new Set<string>();
  const people: {
    id: string; name: string; email: string;
    avatarUrl: string | null; userType: UserType; projectRole: string | null;
  }[] = [];

  if (owner) {
    seen.add(owner.id);
    people.push({ ...owner, projectRole: 'Studio' });
  }
  for (const member of members) {
    if (seen.has(member.user.id)) continue;
    seen.add(member.user.id);
    people.push({ ...member.user, projectRole: member.role });
  }

  return people;
};

/** Throws unless every id is someone who belongs to this project. */
export const assertEligible = async (projectId: string, userIds: string[]): Promise<void> => {
  if (!userIds.length) return;
  const allowed = new Set((await eligibleParticipants(projectId)).map((p) => p.id));
  const stranger = userIds.find((id) => !allowed.has(id));
  if (stranger) {
    throw ApiError.badRequest('Everyone in a conversation must be a member of the project');
  }
};
