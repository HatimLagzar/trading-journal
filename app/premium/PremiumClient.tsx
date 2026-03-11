'use client'

import { useEffect, useMemo, useState } from 'react';
import { usePremiumAccess } from '@/lib/usePremiumAccess';
import AuthNavbar from '@/app/components/AuthNavbar';
import type { CheckoutPlan } from '@/services/subscription';

const PREMIUM_FEATURES = [
  'AI-assisted trade prefill from TradingView screenshots',
  'Paste screenshots directly in backtesting add-trade modal',
  'Paste images in live trade Decisions discussion (Cmd+V / Ctrl+V)',
  'Keep add-trade modal open for rapid backtesting loops',
  'Open one-click trade charts on TradingView',
  'Open multiple live-trade charts as floating draggable/resizable widgets',
  'Import live trades from CSV/XLSX files',
  'Export backtesting trades to spreadsheet-friendly CSV',
  'Mirror live trades to backtesting sessions',
  'Per-trade Decisions workspace with chart snippet + oldest-to-newest timeline',
  'Date sorting in live and backtesting trades tables',
  'Won/lost outcome filters for live trade review',
  'Selection-based performance stats for focused review',
  'Best/worst day and hour rankings (#1 and #2)',
  'Trades-per-week frequency metric for session pacing',
  'Upload and manage trade screenshots',
  'Create more than 2 trading systems',
];

const FEATURE_LABELS: Record<string, string> = {
  screenshots: 'Screenshot uploads',
  'systems-limit': 'More than 2 systems',
  'mirror-live-trades': 'Live-to-backtesting mirroring',
  'import-trades': 'Trade importing',
  'chart-view': 'Trade chart view',
  'ai-screenshot-import': 'AI screenshot trade prefill',
};

const PREMIUM_RESULTS = [
  {
    title: 'Log backtests much faster',
    text: 'Keep the add-trade modal open, clear only entry/SL/TP, and run through repeated setups without re-opening forms.',
  },
  {
    title: 'Manage live trades with less noise',
    text: 'Use the Decisions workspace to keep chart context, timeline notes, and image-based thinking in one focused place.',
  },
  {
    title: 'Compare setups side-by-side in real time',
    text: 'Open multiple chart widgets on the same screen, drag and resize them, and read cross-market context faster.',
  },
  {
    title: 'Find your timing edge quickly',
    text: 'See best/worst day and hour rankings (#1 and #2) from selected trades or full session data in seconds.',
  },
  {
    title: 'Export and review without cleanup',
    text: 'Download backtesting records in a spreadsheet-friendly CSV format and move straight into review or coaching.',
  },
];

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
  const { isPremium, refreshPremiumStatus } = usePremiumAccess();
  const [cryptoCheckoutLoading, setCryptoCheckoutLoading] = useState<CheckoutPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const annualMonthlyEquivalent = annualPriceUsd / 12;
  const twoMonthCycleCountPerYear = 6;
  const annualSavings = monthlyPriceUsd * twoMonthCycleCountPerYear - annualPriceUsd;

  const featureMessage = useMemo(() => {
    if (!requestedFeature) return null;
    return FEATURE_LABELS[requestedFeature] ?? 'this feature';
  }, [requestedFeature]);

  useEffect(() => {
    if (checkoutState !== 'success') return;
    void refreshPremiumStatus();
  }, [checkoutState, refreshPremiumStatus]);

  async function startCryptoCheckout(plan: CheckoutPlan) {
    setCryptoCheckoutLoading(plan);
    setError(null);

    try {
      const response = await fetch('/api/crypto/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Failed to create crypto checkout session');
      }

      window.location.assign(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start crypto checkout');
    } finally {
      setCryptoCheckoutLoading(null);
    }
  }

  const anyCheckoutLoading = cryptoCheckoutLoading !== null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <AuthNavbar current="premium" variant="dark" />

        <section className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/70 p-6 shadow-2xl shadow-cyan-900/20 sm:p-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-12 top-0 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" />
          </div>
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">
                Trade In Systems Premium
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Upgrade to save hours on journaling and backtesting every week
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Premium is built for traders who want faster loops with better signal quality: AI prefill, rapid
                backtesting entry flow, multi-chart floating analysis, live Decisions journaling, and selection-based stats.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-cyan-100">Keep-open backtesting entry loop</div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-cyan-100">Multi-chart floating widget desk</div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-cyan-100">Decisions timeline + chart snippet</div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-cyan-100">#1/#2 day and hour performance ranks</div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-cyan-100">Date sort + won/lost review filters</div>
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-200/25 bg-cyan-300/10 p-5 text-white">
              <p className="text-sm font-medium text-cyan-100">Best value</p>
              <p className="mt-2 text-4xl font-bold">${formatPrice(annualPriceUsd)}</p>
              <p className="text-sm text-cyan-100">per year • ${formatPrice(annualMonthlyEquivalent)}/mo effective</p>
              <p className="mt-3 text-sm text-cyan-100">Save ${formatPrice(annualSavings)} compared to 2-month billing.</p>
              <button
                onClick={() => startCryptoCheckout('annual')}
                disabled={anyCheckoutLoading}
                className="mt-4 w-full rounded-lg border border-cyan-200/40 bg-slate-900/50 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-slate-900/70 disabled:opacity-60"
              >
                {cryptoCheckoutLoading === 'annual' ? 'Redirecting...' : 'Pay Annual with USDC (Polygon)'}
              </button>
              <p className="mt-2 text-xs text-cyan-100/90">Manual renew. Access activates after blockchain confirmation.</p>
            </div>
          </div>
        </section>

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
          <div className="mb-4 rounded-lg border border-blue-200/60 bg-blue-50 p-3 text-sm text-blue-800">
            You just hit <strong>{featureMessage}</strong>, which is included in Premium. Upgrade to unlock it now.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {PREMIUM_RESULTS.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <PlanCard
            title="2-Month"
            price={`$${formatPrice(monthlyPriceUsd)}`}
            subtitle="every 2 months"
            description="Same full Premium feature access. Ideal if you want more flexible renewals with lower commitment."
            highlights={['Includes all Premium features', 'Billed every 2 months', 'Manual renew anytime']}
            cryptoLoading={cryptoCheckoutLoading === 'monthly'}
            disableAll={anyCheckoutLoading}
            onCryptoSelect={() => startCryptoCheckout('monthly')}
          />
          <PlanCard
            title="Annual"
            price={`$${formatPrice(annualPriceUsd)}`}
            subtitle="per year"
            description="Same full Premium feature access with discounted yearly billing for committed traders."
            highlights={['Includes all Premium features', `Save $${formatPrice(annualSavings)}/year`, `Effective $${formatPrice(annualMonthlyEquivalent)}/mo`]}
            badge={`Save $${formatPrice(annualSavings)}/year`}
            cryptoLoading={cryptoCheckoutLoading === 'annual'}
            disableAll={anyCheckoutLoading}
            onCryptoSelect={() => startCryptoCheckout('annual')}
            highlighted
          />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-lg font-semibold text-white">Everything you unlock</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
              {PREMIUM_FEATURES.map((feature) => (
                <li key={feature} className="rounded-md border border-white/10 bg-slate-900/40 px-3 py-2">
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-lg font-semibold text-white">Why traders upgrade</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2">AI prefill and paste-to-prefill cut repetitive typing while keeping manual confirmation.</li>
              <li className="rounded-md border border-violet-300/20 bg-violet-300/10 px-3 py-2">Decisions workspace keeps your in-trade thought process clean, chronological, and linked to chart context.</li>
              <li className="rounded-md border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-2">Floating chart widgets let you compare multiple active trades at once without tab hopping.</li>
              <li className="rounded-md border border-indigo-300/20 bg-indigo-300/10 px-3 py-2">Keep-open add flow lets you log many backtests quickly without context switching.</li>
              <li className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2">Selection-based stats reveal what changed in a specific subset of trades instantly.</li>
              <li className="rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2">Day/hour rankings (#1/#2) expose your best and worst execution windows.</li>
              <li className="rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2">Date sorting and won/lost filters make live-trade review fast before deeper export analysis.</li>
              <li className="rounded-md border border-orange-300/20 bg-orange-300/10 px-3 py-2">CSV export and mirroring keep review workflows fast and accountability tight.</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-lg font-semibold text-white">Frequently asked</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FaqCard
              question="Can I switch plans later?"
              answer="Yes. You can start on the 2-month plan, then move to annual any time by purchasing the other crypto plan."
            />
            <FaqCard
              question="Will my data stay if I cancel?"
              answer="Yes. Your existing data remains. Premium-only actions become locked until you reactivate."
            />
            <FaqCard
              question="Does AI auto-execute trades or auto-save?"
              answer="No. AI only prefills draft fields from screenshots. You review and confirm before any trade is saved."
            />
            <FaqCard
              question="Can I export backtesting data for coaching or spreadsheets?"
              answer="Yes. Export backtesting trade records as CSV with human-friendly columns and spreadsheet-ready formatting."
            />
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-slate-900 p-6 text-white">
          <h2 className="text-xl font-semibold">Ready to trade with tighter discipline?</h2>
          <p className="mt-2 text-sm text-slate-300">
            Activate Premium in minutes and keep your ongoing-trade workflow fast, visible, and accountable.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => startCryptoCheckout('annual')}
              disabled={anyCheckoutLoading}
              className="rounded-lg border border-cyan-500/60 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-900/30 disabled:opacity-60"
            >
              {cryptoCheckoutLoading === 'annual' ? 'Redirecting...' : `Go Annual • $${formatPrice(annualPriceUsd)} (USDC Polygon)`}
            </button>
            <button
              onClick={() => startCryptoCheckout('monthly')}
              disabled={anyCheckoutLoading}
              className="rounded-lg border border-cyan-500/60 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-900/30 disabled:opacity-60"
            >
              {cryptoCheckoutLoading === 'monthly' ? 'Redirecting...' : `Go 2-Month • $${formatPrice(monthlyPriceUsd)} (USDC Polygon)`}
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
  description,
  highlights,
  badge,
  cryptoLoading,
  disableAll,
  onCryptoSelect,
  highlighted,
}: {
  title: string;
  price: string;
  subtitle: string;
  description: string;
  highlights: string[];
  badge?: string;
  cryptoLoading: boolean;
  disableAll: boolean;
  onCryptoSelect: () => void;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        highlighted
          ? 'border-cyan-300 bg-cyan-300/10 ring-2 ring-cyan-200/40'
          : 'border-white/10 bg-white/[0.04]'
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {badge && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">{badge}</span>}
      </div>
      <p className="text-3xl font-bold text-white">{price}</p>
      <p className="text-sm text-slate-300">{subtitle}</p>
      <p className="mt-1 text-xs text-cyan-100">Same Premium feature set on both plans.</p>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
      <ul className="mt-4 space-y-1 text-xs text-slate-200">
        {highlights.map((highlight) => (
          <li key={highlight}>{`- ${highlight}`}</li>
        ))}
      </ul>
      <button
        onClick={onCryptoSelect}
        disabled={disableAll}
        className="mt-5 w-full rounded-lg border border-cyan-500/70 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {cryptoLoading ? 'Redirecting...' : 'Pay with USDC (Polygon)'}
      </button>
      <p className="mt-2 text-xs text-slate-300">Manual renew. No automatic wallet charges.</p>
    </div>
  );
}

function FaqCard({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/40 p-4">
      <p className="text-sm font-semibold text-white">{question}</p>
      <p className="mt-1 text-sm text-slate-300">{answer}</p>
    </div>
  );
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
