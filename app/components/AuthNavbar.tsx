'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { usePremiumAccess } from '@/lib/usePremiumAccess'

type NavSection = 'trades' | 'systems' | 'backtesting' | 'premium'

interface AuthNavbarProps {
  current: NavSection
  onError?: (message: string) => void
}

const NAV_ITEMS: Array<{ key: NavSection; label: string; href: string }> = [
  { key: 'trades', label: 'Live Trades', href: '/trades' },
  { key: 'systems', label: 'Systems', href: '/systems' },
  { key: 'backtesting', label: 'Backtesting', href: '/backtesting' },
  { key: 'premium', label: 'Premium', href: '/premium' },
]

export default function AuthNavbar({ current, onError }: AuthNavbarProps) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { isPremium, loading: premiumLoading } = usePremiumAccess()
  const [openingPortal, setOpeningPortal] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleOpenBillingPortal() {
    setOpeningPortal(true)
    onError?.('')

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })

      const payload = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Failed to open billing portal')
      }

      window.location.assign(payload.url)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to open billing portal')
    } finally {
      setOpeningPortal(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      router.push('/login')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Trading Journal</p>
          <div className="mt-1 flex items-center gap-2">
            {!premiumLoading && isPremium && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Premium
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {NAV_ITEMS.filter((item) => !(item.key === 'premium' && isPremium)).map((item) => {
            const isActive = item.key === current
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}

          {user ? (
            <>
              <button
                onClick={handleOpenBillingPortal}
                disabled={openingPortal}
                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {openingPortal ? 'Opening...' : 'Manage Subscription'}
              </button>

              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
