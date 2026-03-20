'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePremiumAccess } from '@/lib/usePremiumAccess'
import type { CheckoutPlan } from '@/services/subscription'

const PREMIUM_FEATURES = [
  'Unlimited trading systems',
  'AI screenshot trade prefill',
  'Live trade to backtest mirroring',
  'Advanced chart widgets',
  'Everything in Free',
] as const

const FREE_FEATURES = [
  'Up to 2 trading systems',
  'Unlimited trade entries',
  'Basic performance stats',
  'Manual trade entry',
  'Backtesting workflows',
] as const

const FEATURE_LABELS: Record<string, string> = {
  screenshots: 'Screenshot uploads',
  'systems-limit': 'More than 2 systems',
  'mirror-live-trades': 'Live-to-backtesting mirroring',
  'import-trades': 'Trade importing',
  'chart-view': 'Trade chart view',
  'ai-screenshot-import': 'AI screenshot trade prefill',
}

interface PremiumPricingSectionProps {
  isAuthenticated: boolean
  checkoutState: string | null
  requestedFeature: string | null
  monthlyPriceUsd: number
  annualPriceUsd: number
}

export default function PremiumPricingSection({
  isAuthenticated,
  checkoutState,
  requestedFeature,
  monthlyPriceUsd,
  annualPriceUsd,
}: PremiumPricingSectionProps) {
  const { isPremium, refreshPremiumStatus } = usePremiumAccess()
  const [cryptoCheckoutLoading, setCryptoCheckoutLoading] = useState<CheckoutPlan | null>(null)
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<CheckoutPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  const annualMonthlyEquivalent = annualPriceUsd / 12
  const threeMonthMonthlyEquivalent = monthlyPriceUsd / 3
  const annualSavings = monthlyPriceUsd * 4 - annualPriceUsd
  const annualSavingsLabel = `Save $${formatPrice(annualSavings)}/year vs paying $${formatPrice(monthlyPriceUsd * 4)}/year on the 3-month plan ($${formatPrice(threeMonthMonthlyEquivalent)}/month equivalent)`

  const featureMessage = useMemo(() => {
    if (!requestedFeature) return null
    return FEATURE_LABELS[requestedFeature] ?? 'this feature'
  }, [requestedFeature])

  useEffect(() => {
    if (checkoutState !== 'success') return
    void refreshPremiumStatus()
  }, [checkoutState, refreshPremiumStatus])

  async function startCryptoCheckout(plan: CheckoutPlan) {
    setCryptoCheckoutLoading(plan)
    setError(null)

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
      setError(err instanceof Error ? err.message : 'Failed to start crypto checkout')
      setCryptoCheckoutLoading(null)
    }
  }

  function handlePaidPlanClick(plan: CheckoutPlan) {
    if (!isAuthenticated) {
      window.location.assign('/signup?intent=premium')
      return
    }

    setSelectedPlanForCheckout(plan)
  }

  function closeCheckoutWarning() {
    if (cryptoCheckoutLoading) return
    setSelectedPlanForCheckout(null)
  }

  async function confirmCheckoutWarning() {
    if (!selectedPlanForCheckout) return
    const plan = selectedPlanForCheckout
    setSelectedPlanForCheckout(null)
    await startCryptoCheckout(plan)
  }

  const anyCheckoutLoading = cryptoCheckoutLoading !== null
  const freeHref = isAuthenticated ? '/trades' : '/signup'

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-4">
        {checkoutState === 'success' && (
          <Notice tone="success">Payment successful. Your premium access will be active shortly.</Notice>
        )}

        {checkoutState === 'cancelled' && (
          <Notice tone="warning">Checkout canceled. You can continue free or restart payment any time.</Notice>
        )}

        {featureMessage && !isPremium && (
          <Notice tone="info">
            You just hit <strong>{featureMessage}</strong>, which is included in Premium. Choose a plan below to unlock it.
          </Notice>
        )}

        {error && <Notice tone="error">{error}</Notice>}
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
        <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-8 lg:col-span-1">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">Free</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">$0</span>
              <span className="text-slate-400">free forever</span>
            </div>
          </div>

          <ul className="mb-8 space-y-3">
            {FREE_FEATURES.map((feature) => (
              <PricingFeature key={feature} text={feature} />
            ))}
          </ul>

          <Link
            href={freeHref}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/14 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Get Started Free
          </Link>
        </article>

        <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-8 lg:col-span-1">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">Premium</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">${formatPrice(monthlyPriceUsd)}</span>
              <span className="text-slate-400">/3 months</span>
            </div>
            <p className="mt-2 text-sm text-sky-200">${formatPrice(threeMonthMonthlyEquivalent)}/month equivalent</p>
          </div>

          <ul className="mb-8 space-y-3">
            {PREMIUM_FEATURES.map((feature) => (
              <PricingFeature key={feature} text={feature} highlight />
            ))}
          </ul>

          <button
            onClick={() => handlePaidPlanClick('monthly')}
            disabled={anyCheckoutLoading}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cryptoCheckoutLoading === 'monthly' ? 'Redirecting...' : 'Choose 3-Month'}
          </button>
        </article>

        <article className="relative rounded-[1.5rem] border border-sky-300/30 bg-[#0a1726] p-8 lg:col-span-1">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-sky-300 px-3 py-1 text-xs font-medium text-slate-950">Best Value</span>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white">Annual</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">${formatPrice(annualPriceUsd)}</span>
              <span className="text-slate-400">/year</span>
            </div>
            <p className="mt-2 text-sm text-sky-200">${formatPrice(annualMonthlyEquivalent)}/month effective</p>
            <p className="mt-3 text-xs leading-6 text-slate-300">{annualSavingsLabel}</p>
          </div>

          <ul className="mb-8 space-y-3">
            {PREMIUM_FEATURES.map((feature) => (
              <PricingFeature key={feature} text={feature} highlight />
            ))}
          </ul>

          <button
            onClick={() => handlePaidPlanClick('annual')}
            disabled={anyCheckoutLoading}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cryptoCheckoutLoading === 'annual' ? 'Redirecting...' : 'Choose Annual'}
          </button>
        </article>
      </div>

      {selectedPlanForCheckout && (
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
                onClick={closeCheckoutWarning}
                disabled={anyCheckoutLoading}
                className="rounded-2xl border border-white/14 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCheckoutWarning}
                disabled={anyCheckoutLoading}
                className="rounded-2xl bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:opacity-60"
              >
                {anyCheckoutLoading ? 'Redirecting...' : `Continue to ${selectedPlanForCheckout === 'annual' ? 'Annual' : '3-Month'} Checkout`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PricingFeature({ text, highlight = false }: { text: string; highlight?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <div className={`flex h-5 w-5 items-center justify-center rounded-full ${highlight ? 'bg-sky-300/20 text-sky-200' : 'bg-white/[0.06] text-slate-400'}`}>
        <CheckIcon className="h-3 w-3" />
      </div>
      <span className={highlight ? 'text-slate-100' : 'text-slate-300'}>{text}</span>
    </li>
  )
}

function Notice({ children, tone }: { children: React.ReactNode; tone: 'success' | 'warning' | 'info' | 'error' }) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
      : tone === 'warning'
        ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
        : tone === 'info'
          ? 'border-sky-300/20 bg-sky-300/10 text-sky-100'
          : 'border-rose-300/20 bg-rose-300/10 text-rose-100'

  return <div className={`rounded-[1.1rem] border px-4 py-3 text-sm ${toneClass}`}>{children}</div>
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}
