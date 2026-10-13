import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name; also shown as a native tooltip. Required. */
  label: string
  icon: ReactNode
  tone?: 'default' | 'danger' | 'on-navy'
  size?: 'sm' | 'md'
}

export function IconButton({ label, icon, tone = 'default', size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        size === 'md' ? 'size-9' : 'size-8',
        tone === 'default' && 'text-ink-soft hover:bg-surface hover:text-ink active:bg-line',
        tone === 'danger' && 'text-ink-soft hover:bg-danger-soft hover:text-danger',
        tone === 'on-navy' && 'text-white hover:bg-white/10',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
}
