import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { buttonClasses } from '@/components/ui/Button'

export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  // A failed lazy import usually means a new deployment replaced old chunks.
  const chunkError = error instanceof Error && /dynamically imported module|Importing a module script failed/i.test(error.message)
  return (
    <main className="mx-auto max-w-xl px-4 py-20">
      <p className="label-caps">{notFound ? 'Not found' : 'Error'}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        {notFound ? 'This page does not exist' : chunkError ? 'A new version is available' : 'Something went wrong'}
      </h1>
      <p className="mt-3 text-ink-soft">
        {chunkError ? 'Reload the page to continue.' : 'Your data is safe. Try reloading, or go back to the dashboard.'}
      </p>
      <div className="mt-8 flex gap-3">
        <button type="button" className={buttonClasses('primary')} onClick={() => window.location.reload()}>Reload</button>
        <Link to="/dashboard" className={buttonClasses('secondary')}>Dashboard</Link>
      </div>
    </main>
  )
}

export function NotFoundPage() {
  return (
    <div className="py-10">
      <p className="label-caps">Not found</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">This page does not exist</h1>
      <Link to="/dashboard" className={buttonClasses('secondary', 'md', 'mt-6')}>Back to dashboard</Link>
    </div>
  )
}
