import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import '@/styles/index.css'
import { APP_NAME, isSupabaseConfigured } from '@/app/config'
import { Providers } from '@/app/providers'
import { router } from '@/app/router'
import { SetupRequired } from '@/app/SetupRequired'

document.title = APP_NAME

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    ) : (
      <SetupRequired />
    )}
  </StrictMode>,
)
