'use client';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiRequestError } from '@/lib/api/client';

/**
 * Standard mutation feedback: a toast on success, a readable message on
 * failure, and invalidation of whichever caches the change touched.
 *
 * Field-level validation issues are joined into the toast so the user sees
 * *what* was wrong rather than a bare "Validation failed".
 */
export function useMutationHandlers() {
  const queryClient = useQueryClient();

  const onSuccess = (message: string, invalidate: readonly (readonly unknown[])[] = []) => {
    toast.success(message);
    for (const key of invalidate) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const onError = (error: unknown, fallback = 'Something went wrong') => {
    if (error instanceof ApiRequestError) {
      const detail = error.issues.length
        ? error.issues.map((issue) => issue.message).join(' · ')
        : undefined;
      toast.error(error.message, detail ? { description: detail } : undefined);
      return;
    }
    toast.error(fallback);
  };

  return { onSuccess, onError, queryClient };
}
