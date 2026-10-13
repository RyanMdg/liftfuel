import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/app/config'
import type { Database } from '@/types/database'

export type Client = SupabaseClient<Database>

/**
 * Browser client. Uses the publishable key only; RLS is the security boundary.
 * Sessions use supabase-js's default browser storage and automatic token refresh.
 */
const client: Client | null = isSupabaseConfigured
  ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null

/** Returns the configured client. The app root renders a setup screen when unconfigured. */
export function supabase(): Client {
  if (!client) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
  return client
}
