import { useSyncExternalStore } from 'react'
import { installPromptStore } from '@/lib/pwa'

/** The captured browser install prompt (Chromium only) and whether the app was just installed. */
export function useInstallPrompt() {
  const prompt = useSyncExternalStore(installPromptStore.subscribe, installPromptStore.getPrompt, () => null)
  const installed = useSyncExternalStore(installPromptStore.subscribe, installPromptStore.getInstalled, () => false)
  return { canPrompt: prompt !== null, installed, install: installPromptStore.prompt }
}
