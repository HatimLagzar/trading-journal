'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {}
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function redeemInvite() {
      try {
        await fetch('/api/invites/redeem', {
          method: 'POST',
        })
      } catch {
        if (cancelled) return
        // Ignore invite redemption fetch errors during auth bootstrap.
      }
    }

    void redeemInvite()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const value = {
    user,
    loading,
    signOut: async () => {
      await supabase.auth.signOut()
    }
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  return useContext(AuthContext)
}
