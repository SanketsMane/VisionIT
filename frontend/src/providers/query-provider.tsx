'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api/client';

export function QueryProvider({ children }: { children: ReactNode }) {
  // Created inside state so each browser session gets exactly one client and
  // Fast Refresh never swaps it mid-render.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Client-side failures will not fix themselves on a retry, and
              // retrying a 401 would race the token-refresh interceptor.
              if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
