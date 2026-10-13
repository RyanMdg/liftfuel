/** Central TanStack Query keys. Invalidate the narrowest correct prefix. */
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  goals: () => ['goals'] as const,
  diary: (date: string) => ['diary', date] as const,
  diaryAll: () => ['diary'] as const,
  foods: {
    all: () => ['foods'] as const,
    search: (q: string) => ['foods', 'search', q] as const,
    mine: () => ['foods', 'mine'] as const,
    detail: (id: string) => ['foods', 'detail', id] as const,
    favorites: () => ['foods', 'favorites'] as const,
    recent: () => ['foods', 'recent'] as const,
  },
  recipes: {
    all: () => ['recipes'] as const,
    detail: (id: string) => ['recipes', id] as const,
  },
  nutritionTotals: (from: string, to: string) => ['nutrition-totals', from, to] as const,
  nutritionTotalsAll: () => ['nutrition-totals'] as const,
  weights: () => ['weights'] as const,
  exercises: () => ['exercises'] as const,
  templates: {
    all: () => ['templates'] as const,
    detail: (id: string) => ['templates', id] as const,
  },
  workouts: {
    all: () => ['workouts'] as const,
    history: () => ['workouts', 'history'] as const,
    active: () => ['workouts', 'active'] as const,
    detail: (id: string) => ['workouts', 'detail', id] as const,
    previous: (id: string) => ['workouts', 'previous', id] as const,
    byDate: (date: string) => ['workouts', 'date', date] as const,
  },
  completedSets: (from: string) => ['completed-sets', from] as const,
  completedSetsAll: () => ['completed-sets'] as const,
}
