// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstallScreen } from '@/app/InstallGate'
import { captureInstallPrompt, detectPlatform, isPhone, isStandalone, shouldGate, type DisplayEnv } from '@/lib/pwa'

afterEach(cleanup)

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0;]',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
}

function env(opts: { coarse?: boolean; standalone?: boolean; iosStandalone?: boolean; w?: number; h?: number }): DisplayEnv {
  return {
    matches: (q) => (q === '(pointer: coarse)' ? !!opts.coarse : q === '(display-mode: standalone)' ? !!opts.standalone : false),
    navigatorStandalone: opts.iosStandalone,
    screenWidth: opts.w ?? 390,
    screenHeight: opts.h ?? 844,
  }
}

describe('detectPlatform', () => {
  it('recognises iOS (including iPadOS and Chrome on iOS), Android and in-app browsers', () => {
    expect(detectPlatform(UA.iphoneSafari)).toBe('ios')
    expect(detectPlatform(UA.iphoneChrome)).toBe('ios')
    expect(detectPlatform(UA.ipad, 5)).toBe('ios')
    expect(detectPlatform(UA.ipad, 0)).toBe('other') // a real Mac
    expect(detectPlatform(UA.android)).toBe('android')
    expect(detectPlatform(UA.instagram)).toBe('in-app')
    expect(detectPlatform(UA.facebookAndroid)).toBe('in-app')
    expect(detectPlatform(UA.desktop)).toBe('other')
  })
})

describe('shouldGate', () => {
  it('gates phones in a browser tab', () => {
    expect(shouldGate(env({ coarse: true }), '/dashboard', true)).toBe(true)
    expect(shouldGate(env({ coarse: true }), '/login', true)).toBe(true)
  })

  it('lets the installed app through on Android and iOS', () => {
    expect(isStandalone(env({ standalone: true }))).toBe(true)
    expect(shouldGate(env({ coarse: true, standalone: true }), '/dashboard', true)).toBe(false)
    expect(shouldGate(env({ coarse: true, iosStandalone: true }), '/dashboard', true)).toBe(false)
  })

  it('does not gate tablets, desktops, password recovery links, or when switched off', () => {
    expect(isPhone(env({ coarse: true, w: 820, h: 1180 }))).toBe(false)
    expect(shouldGate(env({ coarse: false, w: 1440, h: 900 }), '/dashboard', true)).toBe(false)
    expect(shouldGate(env({ coarse: false, w: 390, h: 844 }), '/dashboard', true)).toBe(false) // narrow desktop window
    expect(shouldGate(env({ coarse: true }), '/reset-password', true)).toBe(false)
    expect(shouldGate(env({ coarse: true }), '/dashboard', false)).toBe(false)
  })
})

describe('InstallScreen', () => {
  it('shows Add to Home Screen steps on iOS', () => {
    render(<InstallScreen platform="ios" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Install LiftFuel to continue')
    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('shows browser-menu steps on Android until the browser offers an install prompt', () => {
    render(<InstallScreen platform="android" />)
    expect(screen.getByText('Install app')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Install LiftFuel/ })).toBeNull()
  })

  it('asks in-app browser users to open the page in a real browser', () => {
    render(<InstallScreen platform="in-app" />)
    expect(screen.getByRole('heading', { name: 'Open in your browser first' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })

  it('uses the browser install prompt when Chrome offers one, then says to open the app', async () => {
    captureInstallPrompt()
    render(<InstallScreen platform="android" />)
    const prompt = vi.fn(async () => {})
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => { window.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(true) // the mini-infobar is suppressed in favour of our button

    await userEvent.setup().click(screen.getByRole('button', { name: 'Install LiftFuel' }))
    expect(prompt).toHaveBeenCalledTimes(1)
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Installed')
  })
})
