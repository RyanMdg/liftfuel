import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** center: modal dialog. sheet: right-side panel on wide screens, full screen on mobile. */
  variant?: 'center' | 'sheet'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Native <dialog> with showModal(): focus is trapped, Escape closes, the rest of the
 * page is inert, and focus returns to the opener on close.
 */
export function Dialog({ open, onClose, title, description, children, footer, variant = 'center', size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'max-h-none max-w-none overflow-hidden bg-white p-0 text-ink shadow-overlay backdrop:bg-navy/45',
        variant === 'center' && [
          'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] rounded-md border border-line',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
        ].filter(Boolean).join(' '),
        variant === 'sheet' && 'my-0 mr-0 ml-auto h-dvh max-h-dvh w-full border-l border-line sm:max-w-xl',
      )}
    >
      {open && (
        <div className={cn('flex flex-col', variant === 'sheet' ? 'h-dvh' : 'max-h-[calc(100dvh-2rem)]')}>
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <div id={descId} className="mt-0.5 text-sm text-ink-soft">
                  {description}
                </div>
              )}
            </div>
            <IconButton label="Close" icon={<X className="size-5" strokeWidth={1.75} />} onClick={onClose} className="-mr-2 -mt-1" />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">{footer}</footer>
          )}
        </div>
      )}
    </dialog>
  )
}
