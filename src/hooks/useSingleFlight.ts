import { useCallback, useRef } from 'react'

/**
 * Returns a callback that ignores repeat calls while one is in flight (double clicks,
 * repeated Enter presses): every caller gets the same pending promise. The in-flight
 * marker lives in a ref, so the guard holds across re-renders.
 */
export function useSingleFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  const inFlight = useRef<Promise<R> | null>(null)
  return useCallback(
    (...args: A) => {
      if (inFlight.current) return inFlight.current
      const pending = fn(...args).finally(() => {
        inFlight.current = null
      })
      inFlight.current = pending
      return pending
    },
    [fn],
  )
}
