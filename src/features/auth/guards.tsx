import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useAuth } from './AuthProvider'
import { useProfile } from './hooks'

function FullPage({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">{children}</main>
}

/** Signed-out users are sent to /login, remembering where they were going. */
export function RequireAuth() {
  const { session, initializing } = useAuth()
  const location = useLocation()
  if (initializing) return <FullPage><LoadingState label="Checking your session" /></FullPage>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/**
 * App routes require a completed profile. Incomplete profiles go to /onboarding.
 * /onboarding itself is outside this guard, so there is no redirect loop.
 */
export function RequireOnboarded() {
  const profile = useProfile()
  if (profile.isPending) return <FullPage><LoadingState label="Loading your profile" /></FullPage>
  if (profile.isError) {
    return (
      <FullPage>
        <ErrorState title="Could not load your profile" error={profile.error} onRetry={() => profile.refetch()} />
      </FullPage>
    )
  }
  if (!profile.data.onboarding_completed_at) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

/** Login and sign-up pages redirect signed-in users into the app. */
export function RedirectIfSignedIn() {
  const { session, initializing, passwordRecovery } = useAuth()
  const location = useLocation()
  if (initializing) return <FullPage><LoadingState label="Checking your session" /></FullPage>
  if (session && !passwordRecovery) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/dashboard'} replace />
  }
  return <Outlet />
}
