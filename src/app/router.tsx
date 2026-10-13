import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { RedirectIfSignedIn, RequireAuth, RequireOnboarded } from '@/features/auth/guards'
import { LoadingState } from '@/components/ui/States'
import { InstallGate } from './InstallGate'
import { RouteError, NotFoundPage } from './RouteError'

type PageModule = { default: React.ComponentType }
const page = (load: () => Promise<PageModule>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
})

export const routes: RouteObject[] = [
  {
    // On phones outside the installed app, shows install steps instead (see InstallGate).
    element: <InstallGate />,
    errorElement: <RouteError />,
    // Shown while the first lazily loaded route module downloads.
    hydrateFallbackElement: <main className="mx-auto max-w-md px-4 py-16"><LoadingState /></main>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        element: <RedirectIfSignedIn />,
        children: [
          { path: '/login', ...page(() => import('@/features/auth/LoginPage')) },
          { path: '/signup', ...page(() => import('@/features/auth/SignupPage')) },
        ],
      },
      // Outside RedirectIfSignedIn: the recovery link signs the user in before they set a password.
      { path: '/reset-password', ...page(() => import('@/features/auth/ResetPasswordPage')) },
      {
        element: <RequireAuth />,
        children: [
          { path: '/onboarding', ...page(() => import('@/features/onboarding/OnboardingPage')) },
          {
            element: <RequireOnboarded />,
            children: [
              {
                element: <AppShell />,
                errorElement: <RouteError />,
                children: [
                  { path: '/dashboard', ...page(() => import('@/features/dashboard/DashboardPage')) },
                  { path: '/nutrition', ...page(() => import('@/features/nutrition/DiaryPage')) },
                  { path: '/nutrition/foods', ...page(() => import('@/features/nutrition/FoodsPage')) },
                  { path: '/nutrition/recipes', ...page(() => import('@/features/nutrition/RecipesPage')) },
                  { path: '/training', ...page(() => import('@/features/training/TrainingPage')) },
                  { path: '/training/templates', ...page(() => import('@/features/training/TemplatesPage')) },
                  { path: '/training/workouts/:id', ...page(() => import('@/features/training/WorkoutPage')) },
                  { path: '/progress', ...page(() => import('@/features/progress/ProgressPage')) },
                  { path: '/settings', ...page(() => import('@/features/settings/SettingsPage')) },
                  { path: '*', element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
