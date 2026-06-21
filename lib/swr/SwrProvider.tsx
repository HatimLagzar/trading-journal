'use client'

import { SWRConfig } from 'swr'

export function SwrProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 3000,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
