import { APP_NAME } from './config'

/** Shown when Supabase environment variables are missing, instead of a broken app. */
export function SetupRequired() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
      <p className="text-sm font-bold tracking-[0.2em] text-navy uppercase">{APP_NAME}</p>
      <h1 className="mt-10 text-3xl font-bold tracking-tight">Connect a Supabase project</h1>
      <p className="mt-3 text-ink-soft">
        The app needs a Supabase URL and publishable key before it can sign you in or store data.
      </p>
      <ol className="mt-8 list-decimal space-y-3 border-t border-line pt-6 pl-5 text-sm">
        <li>Copy <code className="font-semibold">.env.example</code> to <code className="font-semibold">.env.local</code>.</li>
        <li>Set <code className="font-semibold">VITE_SUPABASE_URL</code> and <code className="font-semibold">VITE_SUPABASE_PUBLISHABLE_KEY</code> from your project's API settings.</li>
        <li>Apply the database migrations in <code className="font-semibold">supabase/migrations</code> (see README).</li>
        <li>Restart the dev server.</li>
      </ol>
      <p className="mt-6 text-sm text-ink-soft">Never use a secret or service_role key in the browser.</p>
    </main>
  )
}
