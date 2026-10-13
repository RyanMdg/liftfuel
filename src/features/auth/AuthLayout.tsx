import type { ReactNode } from 'react'
import { APP_NAME } from '@/app/config'

/** Split layout: a typographic navy panel on wide screens, the form on white. */
export function AuthLayout({ title, description, children, footer }: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside data-surface="navy" className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <p className="text-lg font-bold tracking-[0.18em] uppercase">{APP_NAME}</p>
        <div>
          <p className="max-w-md text-4xl leading-tight font-bold tracking-tight">
            Track what you eat. Log what you lift. See how both move together.
          </p>
          <div className="mt-10 grid max-w-md grid-cols-3 border-t border-white/20 pt-6 text-sm text-on-navy-muted">
            <p>Food diary</p>
            <p>Workout log</p>
            <p>Strength trends</p>
          </div>
        </div>
        <p className="text-sm text-on-navy-muted">Nutrition and strength tracking.</p>
      </aside>
      <main className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <p className="mb-10 text-base font-bold tracking-[0.18em] text-navy uppercase lg:hidden">{APP_NAME}</p>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-2 text-ink-soft">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-6 text-sm text-ink-soft">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
