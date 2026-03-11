import Link from 'next/link'
import type { Metadata } from 'next'
import { DM_Sans, Sora } from 'next/font/google'

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Trading Journal for Faster Execution and Review',
  description:
    'Save hours each week with AI trade prefill, multi-chart floating widgets, per-trade Decisions workspace, and selection-based stats.',
}

const featureCards = [
  {
    title: 'Dedicated Ongoing Trades Desk',
    text: 'Open positions stay in a separate top table so active risk is always visible and one click away.',
  },
  {
    title: 'AI Screenshot Trade Prefill',
    text: 'Upload a TradingView screenshot and get suggested trade fields instantly. You review, edit, and save.',
  },
  {
    title: 'Rapid Backtesting Entry Loop',
    text: 'Keep the add-trade modal open and clear only entry/SL/TP so you can log repeated setups without breaking flow.',
  },
  {
    title: 'Selection-Based Performance Stats',
    text: 'Select specific trades and instantly recalculate R metrics, best/worst day and time, and top #1/#2 patterns.',
  },
  {
    title: 'Decisions Workspace Per Trade',
    text: 'Open a dedicated Decisions screen for any live trade with chart context plus an oldest-to-newest thinking timeline.',
  },
  {
    title: 'Multi-Chart Floating Widgets',
    text: 'Open many trade charts at once as draggable, resizable widgets so you can compare active setups side-by-side.',
  },
  {
    title: 'Date Sorting + Outcome Filters',
    text: 'Click Date headers to sort and filter quickly by Won, Lost, or All trades without breaking your review flow.',
  },
  {
    title: 'Backtesting CSV Export',
    text: 'Export clean trade records with spreadsheet-friendly formatting so reviews and sharing take minutes, not hours.',
  },
]

const processSteps = [
  {
    label: 'Step 1',
    title: 'Capture Fast, Stay Accurate',
    text: 'Use AI screenshot prefill and reusable asset defaults to draft trades quickly without sacrificing control.',
  },
  {
    label: 'Step 2',
    title: 'Batch Through Backtesting',
    text: 'Keep add modal open, paste screenshots, and log multiple setups in sequence for high-volume session replay.',
  },
  {
    label: 'Step 3',
    title: 'Review What Actually Matters',
    text: 'Filter wins/losses, sort by date, compare charts in floating widgets, and inspect #1/#2 timing windows fast.',
  },
]

export default function Home() {
  return (
    <div className={`${dmSans.className} relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute -left-20 bottom-16 h-72 w-72 rounded-full bg-amber-300/12 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-6 sm:px-8 lg:px-12">
        <header className="animate-fade-down mb-14 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
          <p className={`${sora.className} text-sm font-semibold tracking-wide text-cyan-200`}>Trading Journal</p>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-200"
            >
              Start Free
            </Link>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="animate-fade-up">
              <p className="mb-3 inline-flex rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-xs font-medium text-cyan-100">
                New workflow: multi-chart widgets + Decisions workspace
              </p>
              <h1 className={`${sora.className} max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl`}>
                Journal faster. Backtest deeper. Improve in less time.
              </h1>
              <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
                Designed for traders who want faster logging loops and sharper analytics: AI prefill, keep-open backtesting
                entry, multi-chart floating analysis, live Decisions timeline, and selection-based review stats.
              </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-xl bg-amber-300 px-6 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
              >
                Create Free Account
              </Link>
              <a
                href="#how-it-works"
                className="rounded-xl border border-white/25 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
              >
                See How It Works
              </a>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:max-w-lg sm:grid-cols-3">
              <Stat value="Multi-chart desk" label="drag + resize widgets" delay={100} />
              <Stat value="Decisions view" label="chart + thinking feed" delay={180} />
              <Stat value="#1/#2 day & time" label="clear timing edge" delay={260} />
            </div>
          </div>

          <aside
            className="animate-fade-up rounded-3xl border border-white/15 bg-gradient-to-b from-white/12 to-white/5 p-5 shadow-2xl shadow-cyan-900/20"
            style={{ animationDelay: '120ms' }}
          >
            <p className="text-sm font-semibold text-cyan-100">Time-saving gains you will feel first</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-200">
               <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">Backtesting entry speeds up with keep-open add flow and Loss helper for failed setups.</li>
               <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">Open multiple charts as floating widgets to compare setups without leaving your trades screen.</li>
               <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">Per-trade Decisions workspace keeps chart context and ongoing thinking in one focused screen.</li>
               <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">AI screenshot prefill reduces manual typing while keeping final decisions in your hands.</li>
               <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">Date sorting and won/lost filters make it easy to isolate exactly what you want to study.</li>
               <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">Stats switch instantly between all trades and selected trades for focused review.</li>
               <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">CSV exports are clean and spreadsheet-friendly, so reporting and coaching reviews are faster.</li>
            </ul>
            <p className="mt-5 text-xs text-slate-400">
              Perfect for discretionary traders, rule-based traders, and anyone scaling accountability.
            </p>
          </aside>
        </section>

        <section className="mt-18 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((card, index) => (
            <article
              key={card.title}
              className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              style={{ animationDelay: `${220 + index * 120}ms` }}
            >
              <h2 className={`${sora.className} text-lg font-semibold text-white`}>{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{card.text}</p>
            </article>
          ))}
        </section>

        <section id="how-it-works" className="mt-18">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className={`${sora.className} text-2xl font-semibold text-white sm:text-3xl`}>How it works</h2>
            <p className="text-sm text-slate-400">Simple workflow. Serious outcomes.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {processSteps.map((step, index) => (
              <article
                key={step.title}
                className="animate-fade-up rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5"
                style={{ animationDelay: `${340 + index * 130}ms` }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-100">{step.label}</p>
                <h3 className={`${sora.className} mt-2 text-lg font-semibold text-white`}>{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="animate-fade-up mt-18 rounded-3xl border border-amber-200/25 bg-gradient-to-r from-amber-200/10 to-cyan-200/10 p-7 sm:p-9"
          style={{ animationDelay: '500ms' }}
        >
          <p className="text-sm font-medium text-amber-100">Ready to trade with more discipline?</p>
            <h2 className={`${sora.className} mt-2 max-w-2xl text-2xl font-semibold text-white sm:text-3xl`}>
            Start free with ongoing trade control, Decisions journaling, and smarter filters, then unlock premium speed features.
            </h2>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-xl bg-white px-6 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Start Free Today
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-white/40 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
            >
              I Already Have an Account
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function Stat({ value, label, delay }: { value: string; label: string; delay: number }) {
  return (
    <div
      className="animate-fade-up rounded-xl border border-white/10 bg-white/[0.03] p-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-sm font-semibold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}
