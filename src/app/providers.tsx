import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/features/auth/AuthProvider'

function shouldRetry(failureCount: number, error: unknown): boolean {
  const e = error as { code?: string; status?: number }
  // Do not retry permission, validation or not-found errors; retry transient failures once.
  if (e?.code && /^(42|22|23|P0|PGRST)/.test(e.code)) return false
  if (e?.status && e.status >= 400 && e.status < 500) return false
  return failureCount < 1
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: true },
          mutations: { retry: false },
        },
      }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
