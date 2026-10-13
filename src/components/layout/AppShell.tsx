import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { ChartLine, Dumbbell, Gauge, LogOut, Menu, Settings, Utensils, X } from 'lucide-react'
import { APP_NAME } from '@/app/config'
import { IconButton } from '@/components/ui/IconButton'
import { useToast } from '@/components/ui/Toast'
import { signOut } from '@/features/auth/api'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile } from '@/features/auth/hooks'
import { cn } from '@/lib/cn'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/training', label: 'Training', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: ChartLine },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

const iconProps = { 'aria-hidden': true, strokeWidth: 1.75 } as const

/**
 * Navigation: full sidebar at lg+, compact icon rail with labels at md, top bar with
 * a drawer below md. The navy surface carries navigation only; content stays on white.
 */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-dvh md:pl-20 lg:pl-60">
      <a href="#main" className="sr-only z-50 bg-white px-4 py-2 font-semibold text-teal focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>

      {/* lg: full sidebar */}
      <aside data-surface="navy" className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-navy text-white lg:flex">
        <p className="px-6 pt-7 pb-8 text-sm font-bold tracking-[0.2em] uppercase">{APP_NAME}</p>
        <SideNav variant="full" />
        <AccountFooter />
      </aside>

      {/* md: icon rail */}
      <aside data-surface="navy" className="fixed inset-y-0 left-0 hidden w-20 flex-col items-center bg-navy py-5 text-white md:flex lg:hidden">
        <p aria-hidden className="mb-6 text-sm font-bold tracking-[0.2em]">{APP_NAME.slice(0, 1).toUpperCase()}</p>
        <SideNav variant="rail" />
        <div className="mt-auto">
          <SignOutButton compact />
        </div>
      </aside>

      {/* < md: top bar and drawer */}
      <header data-surface="navy" className="sticky top-0 z-30 flex h-14 items-center justify-between bg-navy px-2 text-white md:hidden">
        <IconButton label="Open navigation" tone="on-navy" icon={<Menu className="size-5" {...iconProps} />} onClick={() => setDrawerOpen(true)} />
        <p className="text-sm font-bold tracking-[0.2em] uppercase">{APP_NAME}</p>
        <span className="size-9" aria-hidden />
      </header>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-8 outline-none sm:px-6 sm:py-10 lg:px-10">
        <Outlet />
      </main>
    </div>
  )
}

function SideNav({ variant, onNavigate }: { variant: 'full' | 'rail' | 'drawer'; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className={cn(variant === 'rail' ? 'w-full' : 'flex-1')}>
      <ul className={cn(variant === 'rail' ? 'space-y-1' : 'space-y-0.5')}>
        {NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex border-l-2 transition-colors',
                  isActive ? 'border-white text-white' : 'border-transparent text-on-navy-muted hover:text-white',
                  variant === 'rail'
                    ? 'flex-col items-center gap-1 px-1 py-2.5 text-xs font-semibold'
                    : 'items-center gap-3 px-6 py-2.5 text-sm font-semibold',
                  isActive && variant !== 'rail' && 'bg-white/5',
                )
              }
            >
              <Icon className="size-5" {...iconProps} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function AccountFooter() {
  const { user } = useAuth()
  const profile = useProfile()
  return (
    <div className="border-t border-white/15 px-6 py-5">
      <p className="truncate text-sm font-semibold">{profile.data?.display_name || 'Signed in'}</p>
      <p className="truncate text-xs text-on-navy-muted">{user?.email}</p>
      <SignOutButton />
    </div>
  )
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  const toast = useToast()
  const [pending, setPending] = useState(false)
  const onClick = async () => {
    setPending(true)
    try {
      await signOut()
    } catch (error) {
      toast.error(error, 'Could not sign out.')
      setPending(false)
    }
  }
  if (compact) {
    return <IconButton label="Sign out" tone="on-navy" disabled={pending} icon={<LogOut className="size-5" {...iconProps} />} onClick={onClick} />
  }
  return (
    <button type="button" onClick={onClick} disabled={pending} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-on-navy-muted hover:text-white disabled:opacity-50">
      <LogOut className="size-4" {...iconProps} />
      Sign out
    </button>
  )
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-label="Navigation"
      data-surface="navy"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="my-0 mr-auto ml-0 h-dvh max-h-dvh w-72 max-w-[85vw] bg-navy p-0 text-white backdrop:bg-navy/45 md:hidden"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <p className="text-sm font-bold tracking-[0.2em] uppercase">{APP_NAME}</p>
          <IconButton label="Close navigation" tone="on-navy" icon={<X className="size-5" {...iconProps} />} onClick={onClose} className="-mr-2" />
        </div>
        <SideNav variant="drawer" onNavigate={onClose} />
        <AccountFooter />
      </div>
    </dialog>
  )
}
