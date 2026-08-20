import { del, get, getList, patch, post } from './client';
import { cleanParams } from '@/lib/utils';
import type { Client, ClientContact, ClientStatus } from '@/types';

export interface ClientListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ClientStatus;
  tag?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const clientsApi = {
  list: (params: ClientListParams = {}) =>
    getList<Client>('/clients', { params: cleanParams(params) }),

  stats: () =>
    get<{ total: number; active: number; prospect: number; inactive: number; archived: number }>(
      '/clients/stats',
    ),

  byId: (id: string) => get<Client>(`/clients/${id}`),
  create: (payload: Partial<Client>) => post<Client>('/clients', payload),
  update: (id: string, payload: Partial<Client>) => patch<Client>(`/clients/${id}`, payload),
  remove: (id: string) => del<null>(`/clients/${id}`),

  addContact: (clientId: string, payload: Partial<ClientContact>) =>
    post<ClientContact>(`/clients/${clientId}/contacts`, payload),
  updateContact: (clientId: string, contactId: string, payload: Partial<ClientContact>) =>
    patch<ClientContact>(`/clients/${clientId}/contacts/${contactId}`, payload),
  removeContact: (clientId: string, contactId: string) =>
    del<null>(`/clients/${clientId}/contacts/${contactId}`),
};
