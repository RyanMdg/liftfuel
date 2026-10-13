import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import type { TablesInsert, TablesUpdate, WorkoutSet } from '@/types/database'
import * as api from './api'

export function useExercises() {
  return useQuery({ queryKey: queryKeys.exercises(), queryFn: api.fetchExercises, staleTime: 10 * 60_000 })
}

export function useCreateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TablesInsert<'exercises'>) => api.createExercise(input),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.exercises() }),
  })
}

export function useTemplates() {
  return useQuery({ queryKey: queryKeys.templates.all(), queryFn: api.fetchTemplates })
}

/** All template mutations refresh the template list. */
export function useTemplateMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.templates.all() }),
  })
}

export function useActiveSession() {
  return useQuery({ queryKey: queryKeys.workouts.active(), queryFn: api.fetchActiveSession })
}

export function useSession(id: string) {
  return useQuery({ queryKey: queryKeys.workouts.detail(id), queryFn: () => api.fetchSession(id) })
}

export function usePrevious(sessionId: string) {
  return useQuery({ queryKey: queryKeys.workouts.previous(sessionId), queryFn: () => api.fetchPrevious(sessionId), staleTime: 5 * 60_000 })
}

export function useHistory(limit: number) {
  return useQuery({ queryKey: [...queryKeys.workouts.history(), limit], queryFn: () => api.fetchHistory(limit) })
}

export function useSessionsOnDate(date: string) {
  return useQuery({ queryKey: queryKeys.workouts.byDate(date), queryFn: () => api.fetchSessionsOnDate(date) })
}

export function useExerciseRecords() {
  return useQuery({ queryKey: [...queryKeys.completedSetsAll(), 'records'], queryFn: api.fetchExerciseRecords })
}

export function useCompletedSets(fromDate: string) {
  return useQuery({ queryKey: queryKeys.completedSets(fromDate), queryFn: () => api.fetchCompletedSets(fromDate) })
}

function useInvalidateWorkouts() {
  const qc = useQueryClient()
  return (sessionId?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.workouts.all() })
    qc.invalidateQueries({ queryKey: queryKeys.completedSetsAll() })
    if (sessionId) qc.invalidateQueries({ queryKey: queryKeys.workouts.detail(sessionId) })
  }
}

export function useStartWorkout() {
  const invalidate = useInvalidateWorkouts()
  return useMutation({
    mutationFn: ({ date, templateId, name }: { date: string; templateId: string | null; name?: string }) => api.startWorkout(date, templateId, name),
    onSettled: () => invalidate(),
  })
}

/** Session-level mutation (rename, notes, finish, delete, add or remove exercise). */
export function useSessionMutation<V, R>(sessionId: string, fn: (vars: V) => Promise<R>) {
  const invalidate = useInvalidateWorkouts()
  return useMutation({ mutationFn: fn, onSettled: () => invalidate(sessionId) })
}

/**
 * Set update with an optimistic cache write, so the table responds instantly between
 * sets. Rolls back on error and re-syncs with the server afterwards.
 */
export function useUpdateSet(sessionId: string) {
  const qc = useQueryClient()
  const key = queryKeys.workouts.detail(sessionId)
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TablesUpdate<'workout_sets'> }) => api.updateSet(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<api.SessionDetail>(key)
      if (previous) {
        qc.setQueryData<api.SessionDetail>(key, {
          ...previous,
          workout_exercises: previous.workout_exercises.map((we) => ({
            ...we,
            workout_sets: we.workout_sets.map((s): WorkoutSet => (s.id === id ? { ...s, ...patch } as WorkoutSet : s)),
          })),
        })
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: queryKeys.completedSetsAll() })
    },
  })
}
