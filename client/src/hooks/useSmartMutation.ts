/**
 * useSmartMutation — Routes write operations based on auth state.
 * 
 * For anonymous users: saves to IndexedDB (local browser storage)
 * For logged-in analysts: sends to server via tRPC mutation
 * For admin operations: shows "Request Access" modal
 * 
 * Usage:
 *   const { mutate, isLocal } = useSmartMutation({
 *     serverMutation: trpc.investigations.save.useMutation(),
 *     localStore: 'investigations',
 *     requiresAdmin: false,
 *   });
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { localPut, localDelete, localGetAll, type STORES } from '@/lib/localStore';

type StoreName = typeof STORES[keyof typeof STORES];

interface SmartMutationOptions<TInput, TOutput> {
  /** The tRPC mutation hook result */
  serverMutation?: {
    mutateAsync: (input: TInput) => Promise<TOutput>;
    isPending: boolean;
    error: unknown;
  };
  /** Which IndexedDB store to use for local saves */
  localStore?: StoreName;
  /** If true, only admins can execute — shows access request for others */
  requiresAdmin?: boolean;
  /** Custom local save handler (overrides default IndexedDB put) */
  onLocalSave?: (input: TInput) => Promise<TOutput>;
  /** Called when auth modal should be shown */
  onAuthRequired?: () => void;
  /** Called when admin access is required */
  onAdminRequired?: () => void;
}

interface SmartMutationResult<TInput, TOutput> {
  /** Execute the mutation (routes to local or server based on auth) */
  mutate: (input: TInput) => Promise<TOutput | null>;
  /** Whether the last operation was saved locally */
  isLocal: boolean;
  /** Loading state */
  isPending: boolean;
  /** Error from last operation */
  error: unknown;
}

export function useSmartMutation<TInput extends Record<string, unknown>, TOutput = unknown>(
  options: SmartMutationOptions<TInput, TOutput>
): SmartMutationResult<TInput, TOutput> {
  const { user } = useAuth();
  const [isLocal, setIsLocal] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mutate = useCallback(async (input: TInput): Promise<TOutput | null> => {
    setError(null);
    setIsPending(true);

    try {
      // Admin-only operations
      if (options.requiresAdmin) {
        if (!user) {
          options.onAuthRequired?.();
          setIsPending(false);
          return null;
        }
        if (user.role !== 'admin') {
          options.onAdminRequired?.();
          setIsPending(false);
          return null;
        }
        // Admin is logged in — use server
        if (options.serverMutation) {
          const result = await options.serverMutation.mutateAsync(input);
          setIsLocal(false);
          return result;
        }
      }

      // Analyst operations (requires login)
      if (user && options.serverMutation) {
        // Logged in — use server
        const result = await options.serverMutation.mutateAsync(input);
        setIsLocal(false);
        return result;
      }

      // Anonymous user — save locally
      if (options.onLocalSave) {
        const result = await options.onLocalSave(input);
        setIsLocal(true);
        return result;
      }

      if (options.localStore) {
        const result = await localPut(options.localStore, input as Record<string, unknown>);
        setIsLocal(true);
        return result as unknown as TOutput;
      }

      // No local store configured and not logged in — prompt auth
      options.onAuthRequired?.();
      return null;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setIsPending(false);
    }
  }, [user, options]);

  return { mutate, isLocal, isPending, error };
}

/**
 * useLocalData — Read data from IndexedDB for anonymous users
 */
export function useLocalData<T>(store: StoreName) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const items = await localGetAll<T>(store);
      setData(items);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [store]);

  // Initial load
  useState(() => { refresh(); });

  return { data, loading, refresh };
}
