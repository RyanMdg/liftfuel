import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: string
  eyebrow?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  tabs?: Array<{ to: string; label: string; end?: boolean }>
  tabsLabel?: string
}

export function PageHeader({ title, eyebrow, description, actions, tabs, tabsLabel }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 border-b border-line', tabs ? 'pb-0' : 'pb-6')}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow && <p className="label-caps mb-2">{eyebrow}</p>}
          <h1 className="text-3xl font-bold tracking-tight sm:text-display">{title}</h1>
          {description && <p className="mt-2 max-w-prose text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && (
        <nav aria-label={tabsLabel ?? `${title} sections`} className="-mb-px mt-6 overflow-x-auto">
          <ul className="flex gap-6">
            {tabs.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn(
                      'inline-block border-b-2 pb-3 text-sm font-semibold whitespace-nowrap transition-colors',
                      isActive ? 'border-teal text-ink' : 'border-transparent text-ink-soft hover:border-line-strong hover:text-ink',
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  )
}

interface SectionHeadingProps {
  title: ReactNode
  /** Heading level; sections inside a page default to h2. */
  as?: 'h2' | 'h3'
  meta?: ReactNode
  actions?: ReactNode
  id?: string
  className?: string
}

/** Section title with a hairline divider underneath. No background container. */
export function SectionHeading({ title, as: Tag = 'h2', meta, actions, id, className }: SectionHeadingProps) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4 border-b border-line pb-2', className)}>
      <div className="flex min-w-0 flex-col gap-y-0.5 sm:flex-row sm:items-baseline sm:gap-x-4">
        <Tag id={id} className={cn('font-semibold', Tag === 'h2' ? 'text-lg' : 'text-base')}>
          {title}
        </Tag>
        {meta && <span className="num text-sm text-ink-soft">{meta}</span>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}

export function Divider({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  if (vertical) return <span aria-hidden className={cn('mx-3 inline-block h-3.5 w-px bg-line-strong align-middle', className)} />
  return <hr className={cn('border-line', className)} />
}
