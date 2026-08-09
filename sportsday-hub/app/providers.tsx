'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useState } from 'react'
import { TabSyncListener } from '@/components/sync/tab-sync-listener'

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30초
            refetchOnWindowFocus: true,
          },
        },
      })
  )
  return (
    <QueryClientProvider client={client}>
      {children}
      <TabSyncListener />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  )
}
