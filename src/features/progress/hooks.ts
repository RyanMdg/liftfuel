import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import { queryKeys } from '@/lib/queryKeys'
import * as api from './api'

export function useWeights() {
  return useQuery({ queryKey: queryKeys.weights(), queryFn: api.fetchWeights })
}

export function useSaveWeight() {
  const userId = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: api.WeightInput }) =>
      id ? api.updateWeight(id, input) : api.saveWeight(userId, input),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.weights() }),
  })
}

export function useDeleteWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteWeight,
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.weights() }),
  })
}
