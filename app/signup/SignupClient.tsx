'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/AuthContext'
import type { CheckoutPlan } from '@/services/subscription'

interface SignupClientProps {
  intent: string | null
  step: string | null
  threeMonthPriceUsd: number
  annualPriceUsd: number
}

export default function SignupClient({ intent, step, threeMonthPriceUsd, annualPriceUsd }: SignupClientProps) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [forcePlanStep, setForcePlanStep] = useState(step === 'plan')
  const [checkoutLoading, setCheckoutLoading] = useState<CheckoutPlan | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const isPremiumFlow = intent === 'premium'
  const showPlanStep = step === 'plan' && (Boolean(user) || forcePlanStep)
  const loginHref = isPremiumFlow
    ? '/login?next=%2Fsignup%3Fintent%3Dpremium%26step%3Dplan'
    : '/login?next=%2Fsignup%3Fstep%3Dplan'
  const annualMonthlyEquivalent = annualPriceUsd / 12
  const threeMonthMonthlyEquivalent = threeMonthPriceUsd / 3

  useEffect(() => {
    if (step === 'plan') {
      setForcePlanStep(true)
    }
  }, [step])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const inviteToken = getInviteTokenFromLocation()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: inviteToken
          ? {
              invite_token: inviteToken,
            }
          : {},
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      setForcePlanStep(true)
      router.push(isPremiumFlow ? '/signup?intent=premium&step=plan' : '/signup?step=plan')
      router.refresh()
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  async function startCryptoCheckout(plan: CheckoutPlan) {
    setCheckoutLoading(plan)
    setCheckoutError(null)

    try {
      const response = await fetch('/api/crypto/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      })

      const payload = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Failed to create crypto checkout session')
      }

      window.location.assign(payload.url)
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Failed to start crypto checkout')
      setCheckoutLoading(null)
    }
  }

  function openPlanCheckout(plan: CheckoutPlan) {
    setSelectedPlan(plan)
  }

  function closeCheckoutWarning() {
    if (checkoutLoading) return
    setSelectedPlan(null)
  }

  async function confirmCheckoutWarning() {
    if (!selectedPlan) return
    const plan = selectedPlan
    setSelectedPlan(null)
    await startCryptoCheckout(plan)
  }

  const anyCheckoutLoading = checkoutLoading !== null

  if (success) {
    return (
      <Shell>
        <Card>
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-sky-200 transition hover:text-white">
              Trade In Systems
            </Link>
            <div className="mt-5 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
              <span className="flex h-2 w-2 rounded-full bg-sky-300" />
              <span className="text-slate-300">Account created</span>
            </div>
            <h1 className="mt-5 text-3xl font-semibold text-white">Check your email</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              We sent a confirmation link to <strong>{email}</strong>.
              {isPremiumFlow
                ? ' After confirming, sign in and we will take you to plan selection.'
                : ' After confirming, sign in and choose how you want to start.'}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={loginHref}
                className="rounded-2xl bg-sky-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200"
              >
                {isPremiumFlow ? 'Continue to Plan Selection' : 'Back to Login'}
              </Link>
              <Link
                href="/"
                className="rounded-2xl border border-white/14 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Return Home
              </Link>
            </div>
          </div>
        </Card>
      </Shell>
    )
  }

  if (showPlanStep) {
    if (authLoading && !user) {
      return (
        <Shell>
          <Card>
            <div className="flex flex-col items-center text-center">
              <div className="mt-5 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
                <span className="flex h-2 w-2 rounded-full bg-sky-300" />
                <span className="text-slate-300">Preparing your plan selection</span>
              </div>
              <h1 className="mt-5 text-3xl font-semibold text-white">One moment</h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">We are getting your account ready for the next step.</p>
            </div>
          </Card>
        </Shell>
      )
    }

    return (
      <Shell>
        <div className="w-full max-w-5xl space-y-6">
          <Card className="max-w-none">
            <div className="flex flex-col items-center text-center">
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-sky-200 transition hover:text-white">
                Trade In Systems
              </Link>
              <div className="mt-5 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
                <span className="flex h-2 w-2 rounded-full bg-sky-300" />
                <span className="text-slate-300">Step 2 of 2: Choose your plan</span>
              </div>
              <h1 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">Choose how you want to start</h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Pick Free to enter the app immediately, or choose a Premium plan and continue directly to checkout.
              </p>
            </div>
          </Card>

          {checkoutError && (
            <div className="rounded-[1.1rem] border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
              {checkoutError}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <PlanCard
              title="Free"
              price="$0"
              subtitle="start free"
              description="Enter the app now and upgrade later when you want faster workflows and premium tooling."
              buttonLabel="Continue Free"
              onClick={() => router.push('/trades')}
            />
            <PlanCard
              title="3-Month"
              price={`$${formatPrice(threeMonthPriceUsd)}`}
              subtitle={`every 3 months • $${formatPrice(threeMonthMonthlyEquivalent)}/month equivalent`}
              description="Full premium feature access with the shortest billing cycle we support on crypto checkout."
              buttonLabel={checkoutLoading === 'monthly' ? 'Redirecting...' : 'Choose 3-Month'}
              onClick={() => openPlanCheckout('monthly')}
              disabled={anyCheckoutLoading}
            />
            <PlanCard
              title="Annual"
              price={`$${formatPrice(annualPriceUsd)}`}
              subtitle={`per year • $${formatPrice(annualMonthlyEquivalent)}/month effective`}
              description="Best value for committed traders who want the full premium workflow at the lowest effective monthly cost."
              buttonLabel={checkoutLoading === 'annual' ? 'Redirecting...' : 'Choose Annual'}
              onClick={() => openPlanCheckout('annual')}
              disabled={anyCheckoutLoading}
              highlighted
            />
          </div>
        </div>

        {selectedPlan && (
          <CheckoutModal
            selectedPlan={selectedPlan}
            loading={anyCheckoutLoading}
            onCancel={closeCheckoutWarning}
            onConfirm={confirmCheckoutWarning}
          />
        )}
      </Shell>
    )
  }

  return (
    <Shell>
      <Card>
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-sky-200 transition hover:text-white">
            Trade In Systems
          </Link>
          <div className="mt-5 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
            <span className="flex h-2 w-2 rounded-full bg-sky-300" />
            <span className="text-slate-300">Step 1 of 2: Create your account</span>
          </div>
          <h1 className="mt-5 text-3xl font-semibold text-white">Create Account</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {isPremiumFlow
              ? 'After signup, you will choose Free, 3-Month, or Annual on the next step.'
              : 'After signup, you will choose Free, 3-Month, or Annual before entering the app.'}
          </p>
        </div>

        <form onSubmit={handleSignup} className="mt-8 space-y-4">
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

          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-200">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="password_confirmation"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Creating account...' : isPremiumFlow ? 'Create Account and Continue' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href={loginHref} className="font-medium text-sky-200 transition hover:text-white">
            Sign in
          </Link>
        </p>
      </Card>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07111f] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,_rgba(56,189,248,0.14),_transparent_28%),radial-gradient(circle_at_78%_22%,_rgba(245,158,11,0.12),_transparent_18%),linear-gradient(180deg,_rgba(7,17,31,0.86)_0%,_rgba(7,17,31,1)_62%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(148,163,184,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.28)_1px,transparent_1px)] [background-size:60px_60px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-5 py-10 sm:px-8 lg:px-12">{children}</div>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`w-full max-w-md rounded-[1.8rem] border border-white/12 bg-[#0a1726] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.4)] sm:p-8 ${className}`}>{children}</div>
}

function PlanCard({
  title,
  price,
  subtitle,
  description,
  buttonLabel,
  onClick,
  disabled,
  highlighted,
}: {
  title: string
  price: string
  subtitle: string
  description: string
  buttonLabel: string
  onClick: () => void
  disabled?: boolean
  highlighted?: boolean
}) {
  return (
    <article className={`rounded-[1.5rem] border p-8 ${highlighted ? 'border-sky-300/30 bg-[#0a1726]' : 'border-white/10 bg-white/[0.035]'}`}>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-2 text-4xl font-bold text-white">{price}</div>
      <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
      <p className="mt-4 text-sm leading-7 text-slate-300">{description}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${highlighted ? 'bg-amber-300 text-slate-950 hover:bg-amber-200' : 'bg-sky-300 text-slate-950 hover:bg-sky-200'}`}
      >
        {buttonLabel}
      </button>
    </article>
  )
}

function CheckoutModal({
  selectedPlan,
  loading,
  onCancel,
  onConfirm,
}: {
  selectedPlan: CheckoutPlan
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.6rem] border border-white/12 bg-[#0a1726] p-6 text-slate-100 shadow-2xl">
        <h3 className="text-2xl font-semibold text-white">Before you continue</h3>
        <p className="mt-4 text-sm leading-7 text-slate-200">
          Please send the exact amount shown by NOWPayments. Some wallets or exchanges deduct fees from the transfer, which can make the invoice appear as partially paid.
        </p>
        <p className="mt-3 text-sm leading-7 text-amber-100">
          Double-check the final send amount in your wallet or exchange so it matches the invoice exactly.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-2xl border border-white/14 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-2xl bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:opacity-60"
          >
            {loading ? 'Redirecting...' : `Continue to ${selectedPlan === 'annual' ? 'Annual' : '3-Month'} Checkout`}
          </button>
        </div>
      </div>
    </div>
  )
}

function getInviteTokenFromLocation(): string {
  if (typeof window === 'undefined') return ''

  const params = new URLSearchParams(window.location.search)
  return params.get('invite')?.trim() ?? ''
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}
