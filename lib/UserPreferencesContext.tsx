'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { DEFAULT_BREAK_EVEN_R_THRESHOLD } from '@/lib/trade-outcome'
import { getUserPreferences } from '@/services/preferences'
import type { UserPreferences } from '@/services/preferences'

type UserPreferencesContextValue = {
  loading: boolean
  preferences: UserPreferences | null
  breakEvenRThreshold: number
  refreshPreferences: () => Promise<void>
  setPreferences: (preferences: UserPreferences) => void
}

const UserPreferencesContext = createContext<UserPreferencesContextValue>({
  loading: true,
  preferences: null,
  breakEvenRThreshold: DEFAULT_BREAK_EVEN_R_THRESHOLD,
  refreshPreferences: async () => {},
  setPreferences: () => {},
})

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [preferences, setPreferencesState] = useState<UserPreferences | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const loadedUserIdRef = useRef<string | null>(null)

  const refreshPreferences = useCallback(async () => {
    if (!user) {
      loadedUserIdRef.current = null
      setPreferencesState(null)
      setLoading(false)
      return
    }

    if (inFlightRef.current) {
      return inFlightRef.current
    }

    const task = (async () => {
      setLoading(true)
      try {
        const nextPreferences = await getUserPreferences(user.id)
        setPreferencesState(nextPreferences)
        loadedUserIdRef.current = user.id
      } catch {
        setPreferencesState(null)
        loadedUserIdRef.current = user.id
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
      loadedUserIdRef.current = null
      setLoading(false)
      setPreferencesState(null)
      return
    }

    if (loadedUserIdRef.current === user.id) {
      setLoading(false)
      return
    }

    void refreshPreferences()
  }, [authLoading, refreshPreferences, user])

  const setPreferences = useCallback((nextPreferences: UserPreferences) => {
    setPreferencesState(nextPreferences)
    loadedUserIdRef.current = nextPreferences.user_id
  }, [])

  const value = useMemo(() => ({
    loading: authLoading || loading,
    preferences,
    breakEvenRThreshold: preferences?.break_even_r_threshold ?? DEFAULT_BREAK_EVEN_R_THRESHOLD,
    refreshPreferences,
    setPreferences,
  }), [authLoading, loading, preferences, refreshPreferences, setPreferences])

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences(): UserPreferencesContextValue {
  return useContext(UserPreferencesContext)
}
