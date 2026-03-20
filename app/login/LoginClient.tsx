'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface LoginClientProps {
  next: string | null
}

export default function LoginClient({ next }: LoginClientProps) {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const nextPath = useMemo(() => sanitizeNextPath(next), [next])
  const isPlanSelectionFlow = isPlanSelectionPath(nextPath)
  const isPremiumFlow = isPremiumIntentPath(nextPath)
  const signupHref = nextPath === '/trades' ? '/signup' : `/signup?next=${encodeURIComponent(nextPath)}`

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    try {
      await fetch('/api/invites/redeem', {
        method: 'POST',
      })
    } catch {
      // Ignore invite redemption fetch errors during login.
    }

    router.push(nextPath)
    router.refresh()
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07111f] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,_rgba(56,189,248,0.14),_transparent_28%),radial-gradient(circle_at_78%_22%,_rgba(245,158,11,0.12),_transparent_18%),linear-gradient(180deg,_rgba(7,17,31,0.86)_0%,_rgba(7,17,31,1)_62%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(148,163,184,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.28)_1px,transparent_1px)] [background-size:60px_60px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md rounded-[1.8rem] border border-white/12 bg-[#0a1726] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.4)] sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-sky-200 transition hover:text-white">
              Trade In Systems
            </Link>
            {isPlanSelectionFlow && (
              <div className="mt-5 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
                <span className="flex h-2 w-2 rounded-full bg-sky-300" />
                <span className="text-slate-300">Sign in to continue setup</span>
              </div>
            )}
            <h1 className="mt-5 text-3xl font-semibold text-white">Sign In</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {isPremiumFlow
                ? 'Your next step after sign in is plan selection with premium checkout options.'
                : isPlanSelectionFlow
                  ? 'Your next step after sign in is choosing how you want to start.'
                  : 'Welcome back to your trading workspace.'}
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-300/40 focus:bg-white/[0.06]"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-300/40 focus:bg-white/[0.06]"
                placeholder="••••••••"
              />
            </div>

            {error && <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in...' : isPlanSelectionFlow ? 'Sign In and Continue' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href={signupHref} className="font-medium text-sky-200 transition hover:text-white">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function sanitizeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/trades'
  }

  if (value.startsWith('/trades?intent=premium')) {
    return '/signup?intent=premium&step=plan'
  }

  return value
}

function isPremiumIntentPath(value: string): boolean {
  return value === '/premium' || value.startsWith('/signup?intent=premium') || value.startsWith('/?intent=premium')
}

function isPlanSelectionPath(value: string): boolean {
  return isPremiumIntentPath(value) || value.startsWith('/signup?step=plan')
}
