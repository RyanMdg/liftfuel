import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/features/auth/AuthProvider'
import { queryKeys } from '@/lib/queryKeys'
import { resolveGoalForDate } from '@/lib/nutrition'
import type { FoodInput, Meal, UsdaLogItem } from '@/types/database'
import * as api from './api'

export function useDiary(date: string) {
  return useQuery({ queryKey: queryKeys.diary(date), queryFn: () => api.fetchDiary(date), placeholderData: keepPreviousData })
}

export function useGoals() {
  return useQuery({ queryKey: queryKeys.goals(), queryFn: api.fetchGoals, staleTime: 5 * 60_000 })
}

export function useGoalForDate(date: string) {
  const goals = useGoals()
  return { ...goals, resolved: goals.data ? resolveGoalForDate(goals.data, date) : null }
}

export function useNutritionTotals(from: string, to: string) {
  return useQuery({ queryKey: queryKeys.nutritionTotals(from, to), queryFn: () => api.fetchTotals(from, to) })
}

/** Invalidates everything derived from diary entries for the affected dates. */
function useInvalidateDiary() {
  const qc = useQueryClient()
  return (...dates: string[]) => {
    for (const d of new Set(dates)) qc.invalidateQueries({ queryKey: queryKeys.diary(d) })
    qc.invalidateQueries({ queryKey: queryKeys.nutritionTotalsAll() })
    qc.invalidateQueries({ queryKey: queryKeys.foods.recent() })
  }
}

export function useAddEntry() {
  const invalidate = useInvalidateDiary()
  return useMutation({
    mutationFn: api.addEntry,
    onSuccess: (entry) => invalidate(entry.entry_date),
  })
}

export function useLogUsdaFoods() {
  const invalidate = useInvalidateDiary()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, meal, items }: { date: string; meal: Meal; items: UsdaLogItem[] }) => api.logUsdaFoods(date, meal, items),
    onSuccess: (_n, vars) => {
      invalidate(vars.date)
      qc.invalidateQueries({ queryKey: queryKeys.foods.all() })
    },
  })
}

export function useUpdateEntry() {
  const invalidate = useInvalidateDiary()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: api.EntryPatch; previousDate: string }) => api.updateEntry(id, patch),
    onSuccess: (entry, vars) => invalidate(entry.entry_date, vars.previousDate),
  })
}

export function useDeleteEntry() {
  const invalidate = useInvalidateDiary()
  return useMutation({
    mutationFn: ({ id }: { id: string; date: string }) => api.deleteEntry(id),
    onSuccess: (_, vars) => invalidate(vars.date),
  })
}

export function useDuplicateEntry() {
  const invalidate = useInvalidateDiary()
  return useMutation({
    mutationFn: ({ id, date, meal }: { id: string; date: string; meal: Meal }) => api.duplicateEntry(id, date, meal),
    onSuccess: (entry) => invalidate(entry.entry_date),
  })
}

export function useSaveGoal() {
  const userId = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: api.GoalValues) => api.saveGoal(userId, values),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.goals() }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteGoal,
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.goals() }),
  })
}

export function useFoodSearch(query: string) {
  const q = query.trim().toLowerCase()
  return useQuery({
    queryKey: queryKeys.foods.search(q),
    queryFn: () => api.searchFoods(q),
    enabled: q.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
}

export function useFavorites() {
  return useQuery({ queryKey: queryKeys.foods.favorites(), queryFn: api.fetchFavorites })
}

export function useRecentFoods() {
  return useQuery({ queryKey: queryKeys.foods.recent(), queryFn: () => api.fetchRecentFoods() })
}

export function useMyFoods() {
  const userId = useUserId()
  return useQuery({ queryKey: queryKeys.foods.mine(), queryFn: () => api.fetchMyFoods(userId) })
}

export function useCatalogFoods(enabled: boolean) {
  return useQuery({ queryKey: [...queryKeys.foods.all(), 'catalog'], queryFn: api.fetchCatalogFoods, enabled, staleTime: 10 * 60_000 })
}

export function useSaveFood() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, food, servings }: { id: string | null; food: FoodInput; servings: Array<{ id?: string; label: string; amount: number }> }) =>
      api.saveFood(id, food, servings),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.foods.all() })
      // Editing an ingredient food recalculates recipes in the database.
      qc.invalidateQueries({ queryKey: queryKeys.recipes.all() })
    },
  })
}

export function useDeleteFood() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteFood,
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.foods.all() }),
  })
}

export function useSetFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ foodId, favorite }: { foodId: string; favorite: boolean }) => api.setFavorite(foodId, favorite),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.foods.favorites() }),
  })
}

export function useRecipes() {
  return useQuery({ queryKey: queryKeys.recipes.all(), queryFn: api.fetchRecipes })
}

export function useRecipe(id: string | null) {
  return useQuery({ queryKey: queryKeys.recipes.detail(id ?? 'none'), queryFn: () => api.fetchRecipe(id!), enabled: !!id })
}

export function useSaveRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: api.RecipeInput }) => api.saveRecipe(id, input),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.recipes.all() })
      qc.invalidateQueries({ queryKey: queryKeys.foods.all() })
    },
  })
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteRecipe,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.recipes.all() })
      qc.invalidateQueries({ queryKey: queryKeys.foods.all() })
    },
  })
}
