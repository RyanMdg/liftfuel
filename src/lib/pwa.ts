/**
 * Install detection for the phone install gate. Pure functions take their inputs so they can be
 * unit-tested; the browser wrappers at the bottom read the real environment.
 */

export type InstallPlatform = 'ios' | 'android' | 'in-app' | 'other'

/** In-app browsers (social and chat apps) cannot install web apps. */
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Snapchat|LinkedInApp|MicroMessenger|\bMessenger\b|Twitter/i

export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (IN_APP.test(userAgent)) return 'in-app'
  // iPadOS reports a Mac user agent, so touch support tells them apart.
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'other'
}

export interface DisplayEnv {
  matches: (query: string) => boolean
  /** iOS Safari's non-standard flag for home-screen apps. */
  navigatorStandalone?: boolean
  screenWidth: number
  screenHeight: number
}

export function isStandalone(env: DisplayEnv): boolean {
  return env.navigatorStandalone === true ||
    ['standalone', 'fullscreen', 'minimal-ui'].some((mode) => env.matches(`(display-mode: ${mode})`))
}

/** Phones only: a touch-first device whose short screen side is under 600 CSS px. Tablets and desktops are not gated. */
export function isPhone(env: DisplayEnv): boolean {
  return env.matches('(pointer: coarse)') && Math.min(env.screenWidth, env.screenHeight) < 600
}

/** Paths that must work in the browser: password recovery links open there, not in the installed app. */
export const GATE_EXEMPT_PATHS = ['/reset-password']

export function shouldGate(env: DisplayEnv, pathname: string, enabled: boolean): boolean {
  return enabled && isPhone(env) && !isStandalone(env) && !GATE_EXEMPT_PATHS.includes(pathname)
}

export function browserDisplayEnv(): DisplayEnv {
  return {
    matches: (q) => window.matchMedia?.(q).matches ?? false,
    navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  }
}

/** Chromium's install prompt event (not in the TypeScript DOM types). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Listener = () => void
let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<Listener>()
const emit = () => listeners.forEach((l) => l())

/**
 * Call once at startup, before React renders. Chromium fires `beforeinstallprompt` early, often
 * before the install screen mounts, so the event is kept here until it is used.
 */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

export const installPromptStore = {
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  getPrompt: () => deferred,
  getInstalled: () => installed,
  async prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const event = deferred
    if (!event) return 'unavailable'
    deferred = null // A prompt event can only be used once.
    emit()
    await event.prompt()
    return (await event.userChoice).outcome
  },
}

/** Registers the service worker in production builds only, so development never serves cached files. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app works without it; installability on some browsers needs it.
    })
  })
}
