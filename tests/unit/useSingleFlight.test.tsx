// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSingleFlight } from '@/hooks/useSingleFlight'

describe('useSingleFlight (duplicate submission handling)', () => {
  it('shares one in-flight call between rapid repeated submissions, across re-renders', async () => {
    let calls = 0
    let release: () => void = () => {}
    const submit = () => {
      calls++
      return new Promise<number>((resolve) => {
        release = () => resolve(calls)
      })
    }
    const { result, rerender } = renderHook(({ fn }) => useSingleFlight(fn), { initialProps: { fn: submit } })
    const a = result.current()
    rerender({ fn: () => submit() }) // a new function identity, as after a state update
    const b = result.current()
    const c = result.current()
    await act(async () => release())
    expect(await Promise.all([a, b, c])).toEqual([1, 1, 1])
    expect(calls).toBe(1)

    const d = result.current()
    await act(async () => release())
    expect(await d).toBe(2)
    expect(calls).toBe(2)
  })

  it('allows a retry after a failure', async () => {
    let calls = 0
    const { result } = renderHook(() => useSingleFlight(async () => {
      calls++
      if (calls === 1) throw new Error('network')
      return 'ok'
    }))
    await expect(result.current()).rejects.toThrow('network')
    await expect(result.current()).resolves.toBe('ok')
  })
})
