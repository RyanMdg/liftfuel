/** Product name, configurable per deployment. Never hardcode it in components. */
export const APP_NAME = import.meta.env.VITE_APP_NAME?.trim() || 'LiftFuel'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''

/** On phones, require the installed app (home-screen PWA) instead of the browser tab. */
export const INSTALL_GATE_ENABLED = import.meta.env.VITE_INSTALL_GATE?.trim() !== 'off'

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)
