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
  title: 'Trading Journal for Active Trade Control',
  description:
    'Control active risk with a dedicated ongoing-trades desk, log faster with AI screenshot prefill, and review your edge in R.',
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
    title: 'One-Click Chart Context',
    text: 'Open your trade chart with entry, stop, and exit levels to study exactly why a setup won or failed.',
  },
  {
    title: 'Live + Backtesting In One Flow',
    text: 'Mirror live trades into a backtesting session so every execution stays accountable to your plan.',
  },
]

const processSteps = [
  {
    label: 'Step 1',
    title: 'Capture Fast, Stay Accurate',
    text: 'Log manually or use AI screenshot prefill to draft coin, direction, entry, and stop in seconds.',
  },
  {
    label: 'Step 2',
    title: 'Manage Ongoing Trades Fast',
    text: 'Keep open positions front and center in their own table so closing, editing, and chart checks happen faster.',
  },
  {
    label: 'Step 3',
    title: 'Review in R, Improve Weekly',
    text: 'Use period R stats and system filters to reinforce what works and cut what does not.',
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
              New workflow: Ongoing trades desk + AI screenshot prefill
            </p>
            <h1 className={`${sora.className} max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl`}>
              Control open risk first. Improve results faster.
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
              Keep active trades front and center, prefill journals from screenshots, and review your edge in R.
              Built for traders who want cleaner execution and clearer decisions.
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
              <Stat value="Ongoing desk" label="active risk control" delay={100} />
              <Stat value="R-focused" label="performance review" delay={180} />
              <Stat value="Entry/stop/exit chart" label="loss & win replay" delay={260} />
            </div>
          </div>

          <aside
            className="animate-fade-up rounded-3xl border border-white/15 bg-gradient-to-b from-white/12 to-white/5 p-5 shadow-2xl shadow-cyan-900/20"
            style={{ animationDelay: '120ms' }}
          >
            <p className="text-sm font-semibold text-cyan-100">What improves first?</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-200">
              <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">Your open positions are impossible to ignore, so trade management gets faster.</li>
              <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">You can replay trades on chart with entry, stop, and exit to diagnose mistakes and strengths.</li>
              <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">Your journaling speed increases with AI-assisted prefill and imports.</li>
              <li className="rounded-xl border border-white/10 bg-slate-900/40 p-3">Your strategy feedback loop gets clearer through R-based review and system filters.</li>
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
            Start free with the ongoing-trades desk, then unlock AI prefill, charts, and imports when ready.
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
