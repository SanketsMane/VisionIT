import { ApiError } from '@utils/api-error';
import { resolvePagination } from '@utils/pagination.util';
import { toNumber } from '@utils/money.util';
import { ClientsModel } from './clients.model';
import type { ContactDto, CreateClientDto, ListClientsDto, UpdateClientDto } from './clients.validation';

const SORTABLE = ['createdAt', 'name', 'updatedAt', 'status'];

/** Turns '' from optional URL inputs into a real null before it hits the DB. */
const blankToNull = <T extends Record<string, unknown>>(input: T): T => {
  const output = { ...input };
  for (const key of Object.keys(output)) {
    if (output[key] === '') (output as Record<string, unknown>)[key] = null;
  }
  return output;
};

export const ClientsService = {
  async list(userId: string, query: ListClientsDto) {
    const pagination = resolvePagination(query, {
      allowedSortFields: SORTABLE,
      defaultSortBy: 'createdAt',
    });
    const where = ClientsModel.buildWhere(userId, query);

    const [items, total] = await Promise.all([
      ClientsModel.findMany(where, {
        skip: pagination.skip,
        take: pagination.take,
        orderBy: pagination.orderBy,
      }),
      ClientsModel.count(where),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  },

  async getById(userId: string, id: string) {
    const client = await ClientsModel.findById(userId, id);
    if (!client) throw ApiError.notFound('Client');

    // Financial summary is derived on read rather than denormalised, so it can
    // never drift out of sync with the invoice and payment tables.
    const [revenue, outstanding] = await Promise.all([
      ClientsModel.revenueFor(userId, id),
      ClientsModel.outstandingFor(userId, id),
    ]);

    return {
      ...client,
      summary: {
        totalRevenue: toNumber(revenue._sum.amount),
        paymentsCount: revenue._count,
        outstandingAmount: toNumber(outstanding._sum.balanceDue),
        openInvoicesCount: outstanding._count,
      },
    };
  },

  create: (userId: string, dto: CreateClientDto) =>
    ClientsModel.create(userId, blankToNull(dto)),

  async update(userId: string, id: string, dto: UpdateClientDto) {
    if (!(await ClientsModel.exists(userId, id))) throw ApiError.notFound('Client');
    return ClientsModel.update(userId, id, blankToNull(dto));
  },

  async remove(userId: string, id: string) {
    if (!(await ClientsModel.exists(userId, id))) throw ApiError.notFound('Client');

    if (await ClientsModel.hasOpenInvoices(userId, id)) {
      throw ApiError.badRequest(
        'This client has unpaid invoices. Settle or cancel them before archiving the client.',
      );
    }

    await ClientsModel.softDelete(userId, id);
  },

  async addContact(userId: string, clientId: string, dto: ContactDto) {
    if (!(await ClientsModel.exists(userId, clientId))) throw ApiError.notFound('Client');
    const contact = await ClientsModel.addContact(clientId, dto);
    if (dto.isPrimary) await ClientsModel.demoteOtherPrimaries(clientId, contact.id);
    return contact;
  },

  async updateContact(userId: string, clientId: string, contactId: string, dto: Partial<ContactDto>) {
    if (!(await ClientsModel.exists(userId, clientId))) throw ApiError.notFound('Client');
    const contact = await ClientsModel.updateContact(clientId, contactId, dto);
    if (dto.isPrimary) await ClientsModel.demoteOtherPrimaries(clientId, contactId);
    return contact;
  },

  async removeContact(userId: string, clientId: string, contactId: string) {
    if (!(await ClientsModel.exists(userId, clientId))) throw ApiError.notFound('Client');
    await ClientsModel.deleteContact(clientId, contactId);
  },

  async stats(userId: string) {
    const counts = await ClientsModel.statusCounts(userId);
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
    return {
      total: counts.reduce((sum, c) => sum + c._count._all, 0),
      active: byStatus.ACTIVE ?? 0,
      prospect: byStatus.PROSPECT ?? 0,
      inactive: byStatus.INACTIVE ?? 0,
      archived: byStatus.ARCHIVED ?? 0,
    };
  },
};

export default ClientsService;
