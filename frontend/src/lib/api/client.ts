import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5055/api/v1';

/** The shared success envelope every 2xx response from the API uses. */
export interface ApiEnvelope<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta & Record<string, unknown>;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface FieldIssue {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
  issues?: FieldIssue[];
}

/**
 * Normalised error every caller can rely on, regardless of whether the failure
 * came from the API, the network, or a request that never left the browser.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: FieldIssue[];

  constructor(message: string, status: number, code: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  /** Maps field-level issues onto react-hook-form's setError signature. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.issues.map((issue) => [issue.field, issue.message]));
  }
}

// ── Access token ────────────────────────────────────────────────────────────
// Held in memory only. The long-lived refresh token lives in an httpOnly
// cookie the browser sends automatically, so XSS cannot read either one from
// storage — which is exactly why localStorage is not used here.

let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

export const setUnauthenticatedHandler = (handler: (() => void) | null): void => {
  onUnauthenticated = handler;
};

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ── Refresh coordination ────────────────────────────────────────────────────
// When several requests 401 at once, only the first performs the refresh; the
// rest wait on the same promise and then retry. Without this, a dashboard that
// fires eight parallel queries would trigger eight refreshes and, because the
// server rotates refresh tokens, seven of them would fail and sign the user out.

let refreshPromise: Promise<string> | null = null;

const performRefresh = async (): Promise<string> => {
  const response = await axios.post<ApiEnvelope<{ accessToken: string }>>(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true, headers: { 'Content-Type': 'application/json' } },
  );
  const token = response.data.data.accessToken;
  setAccessToken(token);
  return token;
};

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
  skipAuthRefresh?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const isRefreshable =
      status === 401 &&
      config &&
      !config._retried &&
      !config.skipAuthRefresh &&
      !config.url?.includes('/auth/refresh') &&
      !config.url?.includes('/auth/login');

    if (isRefreshable) {
      config._retried = true;
      try {
        refreshPromise ??= performRefresh().finally(() => {
          refreshPromise = null;
        });
        const token = await refreshPromise;
        config.headers.Authorization = `Bearer ${token}`;
        return api.request(config);
      } catch {
        setAccessToken(null);
        onUnauthenticated?.();
      }
    }

    if (status === 401 && !config?.skipAuthRefresh) {
      setAccessToken(null);
      onUnauthenticated?.();
    }

    const body = error.response?.data;

    if (body?.message) {
      throw new ApiRequestError(body.message, status ?? 500, body.code ?? 'ERROR', body.issues ?? []);
    }

    if (error.code === 'ECONNABORTED') {
      throw new ApiRequestError('The request timed out. Please try again.', 408, 'TIMEOUT');
    }

    if (!error.response) {
      throw new ApiRequestError(
        'Cannot reach the server. Check that the API is running.',
        0,
        'NETWORK_ERROR',
      );
    }

    throw new ApiRequestError(error.message || 'Something went wrong', status ?? 500, 'ERROR');
  },
);

// ── Typed helpers ───────────────────────────────────────────────────────────
// Every endpoint returns the envelope; these unwrap it so feature code deals in
// domain types and never writes `.data.data`.

export const get = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
  (await api.get<ApiEnvelope<T>>(url, config)).data.data;

/** For list endpoints — returns the rows plus their pagination metadata. */
export const getList = async <T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<{ items: T[]; meta: PaginationMeta & Record<string, unknown> }> => {
  const response = await api.get<ApiEnvelope<T[]>>(url, config);
  return {
    items: response.data.data,
    meta: (response.data.meta ?? {
      page: 1,
      limit: response.data.data.length,
      total: response.data.data.length,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    }) as PaginationMeta & Record<string, unknown>,
  };
};

export const post = async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
  (await api.post<ApiEnvelope<T>>(url, body, config)).data.data;

export const patch = async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
  (await api.patch<ApiEnvelope<T>>(url, body, config)).data.data;

/** For endpoints that replace a whole resource rather than merge into it. */
export const put = async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
  (await api.put<ApiEnvelope<T>>(url, body, config)).data.data;

export const del = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
  (await api.delete<ApiEnvelope<T>>(url, config)).data.data;

/** Downloads a binary response and hands the browser a save dialog. */
export const download = async (url: string, filename: string): Promise<void> => {
  const response = await api.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can abort the download in Safari.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

export default api;
