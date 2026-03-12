'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import type { UserSubscription } from '@/services/subscription'

type PremiumStatusResponse = {
  isPremium: boolean
  subscription: UserSubscription | null
}

type PremiumContextValue = {
  loading: boolean
  isPremium: boolean
  subscription: UserSubscription | null
  refreshPremiumStatus: () => Promise<void>
}

const PremiumContext = createContext<PremiumContextValue>({
  loading: true,
  isPremium: false,
  subscription: null,
  refreshPremiumStatus: async () => {},
})

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)

  const refreshPremiumStatus = useCallback(async () => {
    if (!user) {
      setIsPremium(false)
      setSubscription(null)
      setLoading(false)
      return
    }

    if (inFlightRef.current) {
      return inFlightRef.current
    }

    const task = (async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/subscription/status', {
          method: 'GET',
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch premium status')
        }

        const payload = (await response.json()) as PremiumStatusResponse
        setIsPremium(payload.isPremium)
        setSubscription(payload.subscription)
      } catch {
        setIsPremium(false)
        setSubscription(null)
      } finally {
        setLoading(false)
      }
    })()

    inFlightRef.current = task
    await task
    inFlightRef.current = null
  }, [user])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setLoading(false)
      setIsPremium(false)
      setSubscription(null)
      return
    }

    void refreshPremiumStatus()

    const retryTimer = setTimeout(() => {
      void refreshPremiumStatus()
    }, 1200)

    return () => {
      clearTimeout(retryTimer)
    }
  }, [authLoading, refreshPremiumStatus, user])

  const value = useMemo(() => ({
    loading: authLoading || loading,
    isPremium,
    subscription,
    refreshPremiumStatus,
  }), [authLoading, loading, isPremium, subscription, refreshPremiumStatus])

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
}

export function usePremiumState(): PremiumContextValue {
  return useContext(PremiumContext)
}
