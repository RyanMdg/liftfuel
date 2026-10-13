import { useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Copy, Download, EllipsisVertical, Share, SquarePlus } from 'lucide-react'
import { APP_NAME, INSTALL_GATE_ENABLED } from '@/app/config'
import { Button } from '@/components/ui/Button'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { browserDisplayEnv, detectPlatform, shouldGate, type InstallPlatform } from '@/lib/pwa'

/**
 * Root layout route. On phones in a browser tab, shows install steps instead of the app, so the
 * app is used from the home screen (full screen, no browser bars). Tablets, desktops, the
 * installed app and password-recovery links pass through.
 */
export function InstallGate() {
  const { pathname } = useLocation()
  // Display mode and screen size do not change while a tab is open, so reading them per render is enough.
  if (!shouldGate(browserDisplayEnv(), pathname, INSTALL_GATE_ENABLED)) return <Outlet />
  return <InstallScreen platform={detectPlatform(navigator.userAgent, navigator.maxTouchPoints)} />
}

const icon = 'size-5 shrink-0 text-teal'

export function InstallScreen({ platform }: { platform: InstallPlatform }) {
  const { canPrompt, installed, install } = useInstallPrompt()
  const [copied, setCopied] = useState(false)

  return (
    <main className="flex min-h-dvh flex-col px-4 py-10">
      <p className="text-base font-bold tracking-[0.18em] text-navy uppercase">{APP_NAME}</p>
      <div className="mt-12 max-w-md">
        <h1 className="text-3xl font-bold tracking-tight">
          {installed ? 'Installed' : `Install ${APP_NAME} to continue`}
        </h1>
        <p className="mt-3 text-ink-soft">
          {installed
            ? `Open ${APP_NAME} from your home screen to continue.`
            : `On phones, ${APP_NAME} runs as an app from your home screen: full screen and one tap away when you log a meal or a set.`}
        </p>

        {!installed && (
          <div className="mt-10 border-t border-line pt-8">
            {platform === 'in-app' ? (
              <>
                <h2 className="text-lg font-semibold">Open in your browser first</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  This app&apos;s built-in browser cannot install apps. Open this page in Safari (iPhone) or Chrome (Android), then install it from there.
                </p>
                <Button variant="secondary" className="mt-5" icon={<Copy className="size-4" strokeWidth={1.75} />}
                  onClick={() => navigator.clipboard?.writeText(window.location.origin).then(() => setCopied(true), () => setCopied(false))}>
                  {copied ? 'Link copied' : 'Copy link'}
                </Button>
              </>
            ) : platform === 'ios' ? (
              <Steps title="Add to your Home Screen">
                <Step n={1} icon={<Share className={icon} strokeWidth={1.75} />}>
                  Tap <strong className="font-semibold">Share</strong>. In Safari it is in the bar at the bottom of the screen; in Chrome, at the top right.
                </Step>
                <Step n={2} icon={<SquarePlus className={icon} strokeWidth={1.75} />}>
                  Scroll down and tap <strong className="font-semibold">Add to Home Screen</strong>, then <strong className="font-semibold">Add</strong>.
                </Step>
                <Step n={3}>Open {APP_NAME} from your home screen and sign in.</Step>
              </Steps>
            ) : canPrompt ? (
              <>
                <Button icon={<Download className="size-4" strokeWidth={1.75} />} onClick={() => { void install() }}>
                  Install {APP_NAME}
                </Button>
                <p className="mt-3 text-sm text-ink-soft">Free, no app store. It adds an icon to your home screen.</p>
              </>
            ) : (
              <Steps title="Install from the browser menu">
                <Step n={1} icon={<EllipsisVertical className={icon} strokeWidth={1.75} />}>
                  Open the browser menu (the three dots, usually at the top right).
                </Step>
                <Step n={2} icon={<SquarePlus className={icon} strokeWidth={1.75} />}>
                  Tap <strong className="font-semibold">Install app</strong> or <strong className="font-semibold">Add to Home screen</strong>.
                </Step>
                <Step n={3}>Open {APP_NAME} from your home screen.</Step>
              </Steps>
            )}
          </div>
        )}
      </div>
      <div className="mt-auto max-w-md space-y-2 pt-12 text-sm text-ink-muted">
        <p>Just confirmed your email? Open the installed app and sign in there.</p>
        <p>
          Forgot your password?{' '}
          {/* Recovery links open in the browser, so the reset is done here, then sign in in the app. */}
          <a href="/reset-password" className="font-semibold text-teal underline-offset-4 hover:underline">Reset it in this browser</a>,
          then sign in in the app.
        </p>
      </div>
    </main>
  )
}

function Steps({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2 className="text-lg font-semibold">{title}</h2>
      <ol className="mt-5 space-y-5">{children}</ol>
    </>
  )
}

function Step({ n, icon, children }: { n: number; icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr_1.25rem] items-start gap-3">
      <span className="num text-sm font-semibold text-ink-muted">{n}.</span>
      <span className="text-base">{children}</span>
      {icon ?? <span aria-hidden />}
    </li>
  )
}
