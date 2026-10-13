/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Legacy JWT anon key; accepted as a fallback while projects migrate to publishable keys. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_APP_NAME?: string
  /** "off" disables the phone install screen (used by end-to-end tests). */
  readonly VITE_INSTALL_GATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
