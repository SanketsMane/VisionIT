import { API_BASE_URL, del, download, get, getList, patch, post } from './client';
import { cleanParams } from '@/lib/utils';
import type {
  DocumentType, Invoice, InvoiceItem, InvoiceStatus, Payment, TemplateKey,
} from '@/types';

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
  documentType?: DocumentType;
  clientId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  overdueOnly?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InvoiceStats {
  byStatus: Record<string, { count: number; total: number; balanceDue: number }>;
  aging: { current: number; days1to30: number; days31to60: number; days61to90: number; over90: number };
  totalOutstanding: number;
  overdueCount: number;
}

export interface InvoiceItemInput {
  title: string;
  description?: string | null;
  hsnSac?: string | null;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
  taxRate?: number;
  sortOrder?: number;
}

export interface InvoiceInput {
  clientId: string;
  projectId?: string | null;
  documentType?: DocumentType;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  poNumber?: string | null;
  items: InvoiceItemInput[];
  discountType?: 'NONE' | 'PERCENTAGE' | 'FIXED';
  discountValue?: number;
  shippingAmount?: number;
  taxInclusive?: boolean;
  isInterState?: boolean;
  roundOffTotal?: boolean;
  notes?: string | null;
  terms?: string | null;
  templateKey?: TemplateKey;
  accentColor?: string;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
}

export interface TotalsPreview {
  lines: (InvoiceItem & { netAmount: number })[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  roundOff: number;
  total: number;
  taxBreakdown: {
    rate: number; taxableAmount: number; cgst: number; sgst: number; igst: number; total: number;
  }[];
}

export interface RecordPaymentInput {
  amount: number;
  paidAt?: string;
  method?: string;
  accountId: string;
  reference?: string | null;
  notes?: string | null;
  feeAmount?: number;
}

export const invoicesApi = {
  list: (params: InvoiceListParams = {}) =>
    getList<Invoice>('/invoices', { params: cleanParams(params) }),

  stats: () => get<InvoiceStats>('/invoices/stats'),
  templates: () => get<{ key: TemplateKey; name: string; description: string }[]>('/invoices/templates'),
  byId: (id: string) => get<Invoice>(`/invoices/${id}`),
  byPublicToken: (token: string) => get<Invoice>(`/invoices/public/${token}`),

  /** Server-side totals so the builder never disagrees with the saved invoice. */
  previewTotals: (payload: Pick<InvoiceInput,
    'items' | 'discountType' | 'discountValue' | 'shippingAmount' | 'taxInclusive' | 'isInterState' | 'roundOffTotal'
  >) => post<TotalsPreview>('/invoices/preview-totals', payload),

  create: (payload: InvoiceInput) => post<Invoice>('/invoices', payload),
  update: (id: string, payload: Partial<InvoiceInput>) => patch<Invoice>(`/invoices/${id}`, payload),
  send: (id: string) => post<Invoice>(`/invoices/${id}/send`),
  changeStatus: (id: string, status: InvoiceStatus) => patch<Invoice>(`/invoices/${id}/status`, { status }),
  duplicate: (id: string) => post<Invoice>(`/invoices/${id}/duplicate`, {}),
  cancel: (id: string) => post<Invoice>(`/invoices/${id}/cancel`),
  remove: (id: string) => del<null>(`/invoices/${id}`),

  recordPayment: (id: string, payload: RecordPaymentInput) =>
    post<{ payment: Payment; invoice: Invoice }>(`/invoices/${id}/payments`, payload),
  deletePayment: (id: string, paymentId: string) =>
    del<Invoice>(`/invoices/${id}/payments/${paymentId}`),

  downloadPdf: (id: string, number: string) =>
    download(`/invoices/${id}/pdf`, `${number.replace(/[^\w.-]/g, '_')}.pdf`),

  /** Absolute URL for the preview iframe — bypasses axios, so it needs the token. */
  previewUrl: (id: string, template?: TemplateKey) =>
    `${API_BASE_URL}/invoices/${id}/preview${template ? `?template=${template}` : ''}`,

  publicPdfUrl: (token: string) => `${API_BASE_URL}/invoices/public/${token}/pdf`,

  publicPreviewUrl: (token: string) => `${API_BASE_URL}/invoices/public/${token}/preview`,

  sequences: () => get<{
    id: string; documentType: DocumentType; prefix: string;
    padding: number; nextNumber: number; resetYearly: boolean; year: number;
  }[]>('/invoices/sequences'),

  updateSequence: (payload: {
    documentType: DocumentType; prefix: string; padding: number;
    nextNumber: number; resetYearly: boolean;
  }) => patch('/invoices/sequences', payload),
};
