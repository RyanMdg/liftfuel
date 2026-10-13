import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  initializing: boolean
  /** True after arriving from a password-reset email link. */
  passwordRecovery: boolean
  clearPasswordRecovery: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    let active = true
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setInitializing(false)
      })

    // Keep this callback synchronous: supabase-js warns against awaiting other
    // Supabase calls inside it.
    const { data } = supabase().auth.onAuthStateChange((event, next) => {
      setSession(next)
      setInitializing(false)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') {
        // Expired refresh token or explicit sign-out: drop every cached private record.
        queryClient.clear()
        setPasswordRecovery(false)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),
    }),
    [session, initializing, passwordRecovery],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** The signed-in user's id. Only call inside routes protected by RequireAuth. */
export function useUserId(): string {
  const { user } = useAuth()
  if (!user) throw new Error('useUserId called without a signed-in user')
  return user.id
}
