import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import type { Session, SessionWithBatches, BatchRequest } from '../types';

// Query keys
export const queryKeys = {
  sessions: ['sessions'] as const,
  session: (id: number) => ['sessions', id] as const,
  batchStatus: (id: number) => ['batches', id, 'status'] as const,
};

// Session hooks
export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () => apiService.getSessions(),
  });
}

export function useSession(id: number) {
  return useQuery({
    queryKey: queryKeys.session(id),
    queryFn: () => apiService.getSession(id),
    enabled: !!id,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (name: string) => apiService.createSession(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

// Batch hooks
export function useCreateBatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sessionId, request }: { sessionId: number; request: BatchRequest }) =>
      apiService.createBatch(sessionId, request),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.session(variables.sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

export function useBatchStatus(batchId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.batchStatus(batchId!),
    queryFn: () => apiService.getBatchStatus(batchId!),
    enabled: enabled && !!batchId,
    refetchInterval: (data) => {
      // Auto-refresh if still processing
      if (data?.state?.data?.status === 'pending' || data?.state?.data?.status === 'processing') {
        return 3000; // 3 seconds
      }
      return false;
    },
  });
}