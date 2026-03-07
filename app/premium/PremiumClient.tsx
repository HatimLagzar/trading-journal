'use client'

import { useMemo, useState } from 'react';
import { usePremiumAccess } from '@/lib/usePremiumAccess';
import AuthNavbar from '@/app/components/AuthNavbar';
import type { CheckoutPlan } from '@/services/subscription';

const PREMIUM_FEATURES = [
  'Upload and manage trade screenshots',
  'Create more than 2 trading systems',
  'Mirror live trades to backtesting sessions',
  'Import live trades from CSV/XLSX files',
  'Open one-click trade charts on TradingView',
];

const FEATURE_LABELS: Record<string, string> = {
  screenshots: 'Screenshot uploads',
  'systems-limit': 'More than 2 systems',
  'mirror-live-trades': 'Live-to-backtesting mirroring',
  'import-trades': 'Trade importing',
  'chart-view': 'Trade chart view',
};

interface PremiumClientProps {
  checkoutState: string | null;
  requestedFeature: string | null;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
}

export default function PremiumClient({
  checkoutState,
  requestedFeature,
  monthlyPriceUsd,
  annualPriceUsd,
}: PremiumClientProps) {
  const { isPremium, subscription, loading } = usePremiumAccess();
  const [checkoutLoading, setCheckoutLoading] = useState<CheckoutPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const annualMonthlyEquivalent = annualPriceUsd / 12;
  const annualSavings = monthlyPriceUsd * 12 - annualPriceUsd;

  const featureMessage = useMemo(() => {
    if (!requestedFeature) return null;
    return FEATURE_LABELS[requestedFeature] ?? 'this feature';
  }, [requestedFeature]);

  async function startCheckout(plan: CheckoutPlan) {
    setCheckoutLoading(plan);
    setError(null);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Failed to create checkout session');
      }

      window.location.assign(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Failed to open billing portal');
      }

      window.location.assign(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7f9] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <AuthNavbar current="premium" onError={(message) => setError(message || null)} />

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Trading Journal Premium</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Trade with structure, not impulse</h1>
        </div>

        <div className="mb-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
              Built for serious consistency
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              Keep your live execution aligned with your backtesting edge.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Premium removes the friction between planning and execution. Mirror trades to your backtesting workflow,
              import faster, and keep visual evidence with screenshots.
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 p-5 text-white shadow-lg">
            <p className="text-sm font-medium text-cyan-100">Best-value option</p>
            <p className="mt-2 text-3xl font-bold">${formatPrice(annualPriceUsd)}</p>
            <p className="text-sm text-cyan-100">per year • ${formatPrice(annualMonthlyEquivalent)}/mo effective</p>
            <p className="mt-3 text-sm text-cyan-100">
              Save ${formatPrice(annualSavings)} vs paying monthly all year.
            </p>
          </div>
        </div>

        {checkoutState === 'success' && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Payment successful. Your premium access will be active shortly.
          </div>
        )}

        {checkoutState === 'cancelled' && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Checkout canceled. You can restart anytime.
          </div>
        )}

        {featureMessage && !isPremium && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            {featureMessage} is a premium feature. Upgrade to unlock it.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {!loading && subscription?.stripe_customer_id && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-800">
              {isPremium ? 'You are on Premium' : 'Manage your billing'}
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Plan: {subscription.plan.replace('premium_', '').replace('_', ' ')}
            </p>
            <button
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              {portalLoading ? 'Opening portal...' : 'Manage Subscription'}
            </button>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <PlanCard
            title="Monthly"
            price={`$${formatPrice(monthlyPriceUsd)}`}
            subtitle="per month"
            cta="Choose Monthly"
            loading={checkoutLoading === 'monthly'}
            onSelect={() => startCheckout('monthly')}
          />
          <PlanCard
            title="Annual"
            price={`$${formatPrice(annualPriceUsd)}`}
            subtitle="per year"
            badge={`Save $${formatPrice(annualSavings)}/year`}
            cta="Choose Annual"
            loading={checkoutLoading === 'annual'}
            onSelect={() => startCheckout('annual')}
            highlighted
          />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Everything you unlock</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {PREMIUM_FEATURES.map((feature) => (
                <li key={feature} className="rounded-md bg-slate-50 px-3 py-2">
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Why traders upgrade</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="rounded-md bg-emerald-50 px-3 py-2">Fewer rule breaks because setup-to-session accountability stays visible.</li>
              <li className="rounded-md bg-sky-50 px-3 py-2">Faster weekly review with imports and richer context from screenshots.</li>
              <li className="rounded-md bg-amber-50 px-3 py-2">Clearer strategy decisions by comparing execution against backtested expectations.</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Frequently asked</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FaqCard
              question="Can I switch plans later?"
              answer="Yes. You can start monthly, then move to annual any time from billing management."
            />
            <FaqCard
              question="Will my data stay if I cancel?"
              answer="Yes. Your existing data remains. Premium-only actions become locked until you reactivate."
            />
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-slate-900 p-6 text-white">
          <h2 className="text-xl font-semibold">Ready to trade with tighter discipline?</h2>
          <p className="mt-2 text-sm text-slate-300">
            Pick your plan and activate premium in minutes.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => startCheckout('annual')}
              disabled={checkoutLoading !== null}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-200 disabled:opacity-60"
            >
              {checkoutLoading === 'annual' ? 'Redirecting...' : `Go Annual • $${formatPrice(annualPriceUsd)}`}
            </button>
            <button
              onClick={() => startCheckout('monthly')}
              disabled={checkoutLoading !== null}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {checkoutLoading === 'monthly' ? 'Redirecting...' : `Go Monthly • $${formatPrice(monthlyPriceUsd)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  subtitle,
  badge,
  cta,
  loading,
  onSelect,
  highlighted,
}: {
  title: string;
  price: string;
  subtitle: string;
  badge?: string;
  cta: string;
  loading: boolean;
  onSelect: () => void;
  highlighted?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white p-6 shadow-sm ${highlighted ? 'border-cyan-300 ring-2 ring-cyan-200' : 'border-slate-200'}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {badge && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">{badge}</span>}
      </div>
      <p className="text-3xl font-bold text-slate-900">{price}</p>
      <p className="text-sm text-slate-500">{subtitle}</p>
      <button
        onClick={onSelect}
        disabled={loading}
        className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Redirecting...' : cta}
      </button>
    </div>
  );
}

function FaqCard({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{question}</p>
      <p className="mt-1 text-sm text-slate-600">{answer}</p>
    </div>
  );
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
