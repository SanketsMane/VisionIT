import { del, get, getList, patch, post } from './client';
import { cleanParams } from '@/lib/utils';
import type {
  Project, ProjectCategory, ProjectMilestone, ProjectStatus, ProjectVisibility, Technology,
} from '@/types';

export interface ProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: ProjectCategory;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  clientId?: string;
  featured?: boolean;
  tag?: string;
  technology?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProjectStats {
  total: number;
  totalContractValue: number;
  totalLoggedHours: number;
  byCategory: { category: ProjectCategory; count: number }[];
  byStatus: { status: ProjectStatus; count: number }[];
}

/** The create/update payload takes technologies as plain names, not ids. */
export type ProjectInput = Partial<Omit<Project, 'technologies'>> & { technologies?: string[] };

export const projectsApi = {
  list: (params: ProjectListParams = {}) =>
    getList<Project>('/projects', { params: cleanParams(params) }),

  stats: () => get<ProjectStats>('/projects/stats'),
  technologies: () => get<Technology[]>('/projects/technologies'),
  byId: (id: string) => get<Project>(`/projects/${id}`),
  create: (payload: ProjectInput) => post<Project>('/projects', payload),
  update: (id: string, payload: ProjectInput) => patch<Project>(`/projects/${id}`, payload),
  remove: (id: string) => del<null>(`/projects/${id}`),
  logHours: (id: string, hours: number) => post<Project>(`/projects/${id}/log-hours`, { hours }),
  reorder: (items: { id: string; sortOrder: number }[]) => patch<null>('/projects/reorder', { items }),

  addMilestone: (projectId: string, payload: Partial<ProjectMilestone>) =>
    post<ProjectMilestone>(`/projects/${projectId}/milestones`, payload),
  updateMilestone: (
    projectId: string,
    milestoneId: string,
    payload: Partial<ProjectMilestone> & { completed?: boolean },
  ) => patch<ProjectMilestone>(`/projects/${projectId}/milestones/${milestoneId}`, payload),
  removeMilestone: (projectId: string, milestoneId: string) =>
    del<null>(`/projects/${projectId}/milestones/${milestoneId}`),
};
