'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { usePremiumAccess } from '@/lib/usePremiumAccess'
import { useTheme } from '@/lib/ThemeContext'

type NavSection = 'trades' | 'systems' | 'backtesting' | 'premium' | 'settings'

interface AuthNavbarProps {
  current: NavSection
  onError?: (message: string) => void
  variant?: 'light' | 'dark'
}

const NAV_ITEMS: Array<{ key: NavSection; label: string; href: string }> = [
  { key: 'trades', label: 'Live Trades', href: '/trades' },
  { key: 'systems', label: 'Systems', href: '/systems' },
  { key: 'backtesting', label: 'Backtesting', href: '/backtesting' },
  { key: 'premium', label: 'Premium', href: '/premium' },
  { key: 'settings', label: 'Settings', href: '/settings' },
]

export default function AuthNavbar({ current, variant = 'light' }: AuthNavbarProps) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { isPremium, loading: premiumLoading, subscription } = usePremiumAccess()
  const { isDark: themeIsDark, toggleTheme } = useTheme()
  const [signingOut, setSigningOut] = useState(false)
  const isTrialing = subscription?.status === 'trialing'

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      router.push('/login')
    } finally {
      setSigningOut(false)
    }
  }

  const isDark = variant === 'dark' || themeIsDark

  return (
    <header
      className={`mb-6 rounded-2xl px-4 py-3 ${
        isDark ? 'border border-white/10 bg-white/5 backdrop-blur' : 'border border-slate-200 bg-white shadow-sm'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? 'text-cyan-200' : 'text-cyan-700'
            }`}
          >
            Trade In Systems
          </p>
          <div className="mt-1 flex items-center gap-2">
            {!premiumLoading && isPremium && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                  isTrialing
                    ? isDark
                      ? 'bg-amber-300/20 text-amber-100'
                      : 'bg-amber-100 text-amber-700'
                    : isDark
                      ? 'bg-emerald-300/20 text-emerald-100'
                      : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isTrialing ? 'Trial' : 'Premium'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {NAV_ITEMS.filter((item) => !(item.key === 'premium' && isPremium && !isTrialing)).map((item) => {
            const isActive = item.key === current
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isDark
                      ? 'border border-white/20 bg-white/5 text-slate-100 hover:bg-white/10'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}

          <button
            type="button"
            onClick={toggleTheme}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              isDark
                ? 'border border-white/20 bg-white/5 text-slate-100 hover:bg-white/10'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {themeIsDark ? 'Light mode' : 'Dark mode'}
          </button>

          {user ? (
            <>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
                  isDark
                    ? 'border border-white/20 bg-white/5 text-slate-100 hover:bg-white/10'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isDark
                    ? 'border border-white/20 bg-white/5 text-slate-100 hover:bg-white/10'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Start Free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
