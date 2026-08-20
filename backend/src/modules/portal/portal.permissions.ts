import { ProjectRole } from '@prisma/client';

/**
 * Every capability the portal can gate on. Permissions are derived from a
 * role at request time — never stored per user — so changing what a role can
 * do is a one-line change here rather than a data migration.
 */
export const PERMISSIONS = [
  'project:view',
  'project:manage',

  'milestone:view',
  'milestone:manage',

  'invoice:view',
  'payment:view',
  'payment:submit',
  'payment:approve',

  'bug:view',
  'bug:create',
  'bug:comment',
  'bug:manage',
  'bug:internal',

  'document:view',
  'document:download',
  'document:manage',

  'delivery:view',
  'delivery:confirm',
  'delivery:manage',

  'team:view',
  'team:invite',
  'team:manage',

  'activity:view',
  'announcement:view',
  'announcement:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: Permission[] = [
  'project:view',
  'milestone:view',
  'invoice:view',
  'payment:view',
  'bug:view',
  'document:view',
  'document:download',
  'delivery:view',
  'team:view',
  'activity:view',
  'announcement:view',
];

const TESTER: Permission[] = [
  ...VIEWER,
  'bug:create',
  'bug:comment',
];

const CLIENT_MANAGER: Permission[] = [
  ...TESTER,
  'payment:submit',
  'team:invite',
  'team:manage',
];

const CLIENT_OWNER: Permission[] = [
  ...CLIENT_MANAGER,
  'delivery:confirm',
];

/**
 * An internal team member assigned to a project. Full operational control,
 * including internal bug comments the client must never see.
 */
const INTERNAL_MEMBER: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  [ProjectRole.VIEWER]: VIEWER,
  [ProjectRole.TESTER]: TESTER,
  [ProjectRole.CLIENT_MANAGER]: CLIENT_MANAGER,
  [ProjectRole.CLIENT_OWNER]: CLIENT_OWNER,
  [ProjectRole.INTERNAL_MEMBER]: INTERNAL_MEMBER,
};

export const roleCan = (role: ProjectRole, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role]?.includes(permission) ?? false;

export const permissionsFor = (role: ProjectRole): Permission[] => ROLE_PERMISSIONS[role] ?? [];

/** Roles a client-side member is allowed to hand out. */
export const CLIENT_ASSIGNABLE_ROLES: ProjectRole[] = [
  ProjectRole.CLIENT_MANAGER,
  ProjectRole.TESTER,
  ProjectRole.VIEWER,
];

export const ROLE_LABELS: Record<ProjectRole, string> = {
  [ProjectRole.CLIENT_OWNER]: 'Client Owner',
  [ProjectRole.CLIENT_MANAGER]: 'Client Manager',
  [ProjectRole.TESTER]: 'Tester',
  [ProjectRole.VIEWER]: 'Viewer',
  [ProjectRole.INTERNAL_MEMBER]: 'Internal Member',
};

export const ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  [ProjectRole.CLIENT_OWNER]:
    'Full access to the project, including confirming final delivery and managing the team.',
  [ProjectRole.CLIENT_MANAGER]:
    'Project, finance, documents and testing. Can submit payments and invite teammates.',
  [ProjectRole.TESTER]: 'Can report bugs, comment on issues and view the project.',
  [ProjectRole.VIEWER]: 'Read-only access.',
  [ProjectRole.INTERNAL_MEMBER]: 'Your own team — full operational control of the project.',
};
