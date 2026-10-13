import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import type { Profile, TablesUpdate } from '@/types/database'

const redirect = (path: string) => `${window.location.origin}${path}`

export async function signIn(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** Returns true when a session was created immediately (email confirmation disabled). */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirect('/onboarding') },
  })
  if (error) throw error
  return data.session !== null
}

export async function signOut() {
  const { error } = await supabase().auth.signOut()
  if (error) throw error
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: redirect('/reset-password') })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await supabase().auth.updateUser({ password })
  if (error) throw error
}

export async function fetchProfile(userId: string): Promise<Profile> {
  return unwrap(await supabase().from('profiles').select('*').eq('id', userId).single())
}

export async function updateProfile(userId: string, patch: TablesUpdate<'profiles'>): Promise<Profile> {
  return unwrap(await supabase().from('profiles').update(patch).eq('id', userId).select('*').single())
}
