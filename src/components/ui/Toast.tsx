import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { toUserMessage } from '@/lib/errors'

type Tone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  tone: Tone
  message: string
}

interface ToastApi {
  success: (message: string) => void
  info: (message: string) => void
  error: (errorOrMessage: unknown, fallback?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = nextId.current++
      setItems((all) => [...all.slice(-3), { id, tone, message }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      info: (m) => push('info', m),
      error: (e, fallback) => push('error', typeof e === 'string' ? e : toUserMessage(e, fallback)),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Two persistent live regions so announcements are reliable across screen readers. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6">
        <div role="status" aria-live="polite" className="flex w-full flex-col items-end gap-2">
          {items.filter((t) => t.tone !== 'error').map((t) => <Toast key={t.id} item={t} onDismiss={dismiss} />)}
        </div>
        <div role="alert" aria-live="assertive" className="flex w-full flex-col items-end gap-2">
          {items.filter((t) => t.tone === 'error').map((t) => <Toast key={t.id} item={t} onDismiss={dismiss} />)}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 border border-line border-l-[3px] bg-white py-3 pr-2 pl-4 text-sm shadow-overlay',
        item.tone === 'success' && 'border-l-teal',
        item.tone === 'info' && 'border-l-navy',
        item.tone === 'error' && 'border-l-danger',
      )}
    >
      <p className="flex-1 pt-0.5">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-surface hover:text-ink"
      >
        <X aria-hidden className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
