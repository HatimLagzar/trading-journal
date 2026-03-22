import Link from 'next/link'
import type { Metadata } from 'next'
import { DM_Sans, Sora } from 'next/font/google'
import AuthNavbar from '@/app/components/AuthNavbar'
import PremiumPricingSection from '@/app/components/PremiumPricingSection'
import { createClient } from '@/lib/supabase/server'

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Trading Journal Software for Trade Review and Backtesting',
  description:
    'Trade In Systems is trading journal software for reviewing trades, tracking R-multiple performance, and running structured backtesting workflows.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Trade In Systems | Trading Journal and Backtesting Platform',
    description: 'Journal live trades, review your decisions, track R-multiple performance, and run backtesting sessions in one trading workflow.',
    url: 'https://tradeinsystems.com',
  },
  twitter: {
    title: 'Trade In Systems | Trading Journal and Backtesting Platform',
    description: 'Trading journal software for trade review, R-multiple tracking, and structured backtesting.',
  },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Trade In Systems',
  url: 'https://tradeinsystems.com',
  logo: 'https://tradeinsystems.com/opengraph-image',
  description: 'Trading journal and backtesting software built for deliberate trade review.',
}

const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Trade In Systems',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  description: 'Trade In Systems helps traders journal live trades, review decision-making, track R-multiple performance, and run backtesting workflows.',
  url: 'https://tradeinsystems.com',
  featureList: [
    'Trading journal',
    'Trade review workflow',
    'Backtesting sessions',
    'R-multiple tracking',
    'Trade import and chart review',
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is a trading journal used for?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A trading journal helps traders record entries, exits, risk, mistakes, and post-trade notes so they can review patterns and improve decision-making over time.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I backtest trading ideas inside Trade In Systems?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Trade In Systems includes dedicated backtesting sessions so you can log theoretical trades, review outcomes in R, and analyze your process before risking capital live.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Trade In Systems help me review trades in R-multiple?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The platform tracks R-multiple and performance cards so traders can evaluate strategy quality beyond raw PnL.',
      },
    },
    {
      '@type': 'Question',
      name: 'Who is Trade In Systems built for?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Trade In Systems is built for discretionary traders, systematic traders, backtesters, and prop-style traders who want a serious review workflow instead of a generic spreadsheet.',
      },
    },
  ],
}

const featureCards = [
  {
    title: 'Live Trade Journaling',
    description:
      'Document every trade with structured context, clear separation between open and closed positions, and a workflow designed for fast review.',
    premium: false,
    icon: 'book',
  },
  {
    title: 'System Management',
    description:
      'Organize trades by system and sub-system so performance review stays tied to actual playbooks instead of vague categories.',
    premium: false,
    icon: 'target',
  },
  {
    title: 'Backtesting Sessions',
    description:
      'Run structured backtesting sessions with R-based outcomes, performance cards, trade selection, and faster repeated journaling loops.',
    premium: false,
    icon: 'line',
  },
  {
    title: 'Rich Analytics',
    description:
      'Filter by outcome, direction, system, and selected rows to see win rate, EV per trade, timing patterns, and best or worst performers.',
    premium: false,
    icon: 'bars',
  },
  {
    title: 'Import Trades',
    description:
      'Bring in spreadsheet data through CSV, TSV, XLS, or XLSX uploads with mapping previews and correction-friendly re-import flow.',
    premium: true,
    icon: 'sheet',
  },
  {
    title: 'Chart Widgets',
    description:
      'Open multiple floating trade charts to compare setups side-by-side while staying inside the same review session.',
    premium: true,
    icon: 'grid',
  },
] as const

const socialProofItems = ['Prop Trading Firms', 'Hedge Funds', 'Independent Traders', 'Trading Communities'] as const

const testimonials = [
  {
    quote:
      'Finally a journal that matches how I actually think about trades. The decision workspace during open trades is a game changer.',
    name: 'Marcus Chen',
    role: 'Futures Trader',
  },
  {
    quote:
      'The backtesting integration is seamless. I can go from idea to validated system in the same tool.',
    name: 'Sarah Rodriguez',
    role: 'Prop Trader',
  },
  {
    quote:
      'AI screenshot import saves me 10 minutes per trade. That adds up when you are making 20+ entries a day.',
    name: 'David Kim',
    role: 'Day Trader',
  },
] as const

interface HomePageProps {
  searchParams: Promise<{
    checkout?: string
    feature?: string
  }>
}

export default async function Home({ searchParams }: HomePageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const params = await searchParams
  const threeMonthPriceUsd = parseUsd(
    process.env.PREMIUM_THREE_MONTH_PRICE_USD
      ?? process.env.PREMIUM_TWO_MONTH_PRICE_USD
      ?? process.env.STRIPE_PREMIUM_MONTHLY_PRICE_USD,
    14.97,
  )
  const annualPriceUsd = parseUsd(
    process.env.PREMIUM_ANNUAL_PRICE_USD ?? process.env.STRIPE_PREMIUM_ANNUAL_PRICE_USD,
    49.99,
  )

  return (
    <div className={`${dmSans.className} min-h-screen overflow-x-hidden bg-[#07111f] text-slate-100`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,_rgba(56,189,248,0.14),_transparent_28%),radial-gradient(circle_at_78%_22%,_rgba(245,158,11,0.12),_transparent_18%),linear-gradient(180deg,_rgba(7,17,31,0.86)_0%,_rgba(7,17,31,1)_62%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(148,163,184,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.28)_1px,transparent_1px)] [background-size:60px_60px]" />
        <div className="absolute left-1/4 top-0 h-[32rem] w-[32rem] rounded-full bg-sky-400/8 blur-3xl" />
        <div className="absolute bottom-10 right-1/4 h-[24rem] w-[24rem] rounded-full bg-cyan-300/8 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-6 sm:px-8 lg:px-12">
        {user ? <AuthNavbar current="trades" variant="dark" /> : <PublicNavbar />}

        <main>
          <HeroSection />
          <WorkflowSection />
          <SocialProofBar />
          <FeaturesSection />
          <ProductShowcase />
          <AIFeatureSection />
          <BacktestingSection />
          <PremiumSection
            isAuthenticated={Boolean(user)}
            checkoutState={params.checkout ?? null}
            requestedFeature={params.feature ?? null}
            monthlyPriceUsd={threeMonthPriceUsd}
            annualPriceUsd={annualPriceUsd}
          />
          <TestimonialsSection />
          <CTASection />
          {!user && <Footer />}
        </main>
      </div>
    </div>
  )
}

function PublicNavbar() {
  return (
    <header className="animate-fade-down mb-8 rounded-[1.75rem] border border-white/12 bg-white/6 shadow-[0_24px_80px_rgba(2,6,23,0.26)] backdrop-blur-xl">
      <nav className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-300/25 bg-sky-300/15 text-sky-100">
            <TrendIcon className="h-5 w-5" />
          </div>
          <span className={`${sora.className} text-lg font-semibold tracking-tight text-white`}>Trade In Systems</span>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="#features" className="text-sm text-slate-300 transition-colors hover:text-white">
            Features
          </Link>
          <Link href="#pricing" className="text-sm text-slate-300 transition-colors hover:text-white">
            Pricing
          </Link>
          <Link href="#ai" className="text-sm text-slate-300 transition-colors hover:text-white">
            AI Tools
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-xl border border-white/14 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-200"
          >
            Get Started
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </nav>
    </header>
  )
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden px-1 pb-20 pt-16 md:pb-28 md:pt-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-sky-400/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-cyan-300/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
            <span className="flex h-2 w-2 rounded-full bg-sky-300" />
            <span className="text-slate-300">Now with AI-powered trade analysis</span>
            <ChevronRightIcon className="h-4 w-4 text-slate-400" />
          </div>
        </div>

        <h1 className={`${sora.className} mx-auto max-w-4xl text-center text-4xl font-semibold tracking-tight text-white md:text-6xl lg:text-7xl`}>
          Build Your Trading Edge with <span className="text-sky-300">Deliberate Practice</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-center text-lg text-slate-300 md:text-xl">
          The professional trading journal that helps you document decisions, backtest strategies, and systematically
          improve your trading performance.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 sm:w-auto"
          >
            Start Free Journal
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <a
            href="#showcase"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/14 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
          >
            Watch Demo
          </a>
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16">
          <StatItem value="10,000+" label="Active Traders" />
          <StatItem value="2.4M" label="Trades Logged" />
          <StatItem value="47%" label="Avg. Win Rate Improvement" />
        </div>
      </div>
    </section>
  )
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white md:text-3xl">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  )
}

function WorkflowSection() {
  const steps = [
    {
      number: '01',
      title: 'Log Your Trade',
      description:
        'Enter the setup manually or use AI screenshot prefill from a TradingView image, then attach notes and context to the entry.',
    },
    {
      number: '02',
      title: 'Track It Live',
      description:
        'Keep ongoing positions visible and add decision entries while the trade develops so your thinking is captured in real time.',
    },
    {
      number: '03',
      title: 'Close and Review',
      description:
        'Compare the result against the plan and let stats update instantly across filtered trades, systems, outcomes, and date ranges.',
    },
    {
      number: '04',
      title: 'Backtest and Refine',
      description:
        'Run session-based backtests, compare theoretical performance to live execution, and tighten the edge inside one workflow.',
    },
  ] as const

  return (
    <section className="relative py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/6 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-1">
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-slate-300">
            <ClockIcon className="h-4 w-4 text-sky-200" />
            Workflow
          </div>
          <h2 className={`${sora.className} text-3xl font-semibold tracking-tight text-white md:text-4xl`}>
            From Entry to Edge
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            A structured loop that turns trading activity into measurable improvement.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <article
              key={step.number}
              className="group relative rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6 transition-all hover:border-white/20 hover:bg-white/[0.05]"
            >
              {index < steps.length - 1 && (
                <div className="absolute right-0 top-10 hidden h-px w-8 translate-x-1/2 bg-gradient-to-r from-white/20 to-transparent lg:block" />
              )}

              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-300/10 font-mono text-lg font-bold text-sky-200">
                {step.number}
              </div>

              <h3 className="mb-2 text-lg font-semibold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-300">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function SocialProofBar() {
  return (
    <section className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] py-8">
      <div className="mx-auto max-w-7xl px-6">
        <p className="mb-6 text-center text-sm text-slate-400">Trusted by professional traders at</p>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-70 md:gap-12">
          {socialProofItems.map((name) => (
            <span key={name} className="text-sm font-medium uppercase tracking-wide text-slate-200">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-1">
        <div className="mb-16 text-center">
          <h2 className={`${sora.className} text-3xl font-semibold tracking-tight text-white md:text-4xl`}>
            Everything You Need to Improve
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            A complete toolkit for serious traders who want to systematically build their edge.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  title,
  description,
  premium,
  icon,
}: {
  title: string
  description: string
  premium?: boolean
  icon: (typeof featureCards)[number]['icon']
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6 transition-all hover:border-white/20 hover:bg-white/[0.05]">
      {premium && (
        <div className="absolute right-4 top-4">
          <span className="rounded-full bg-sky-300/10 px-2 py-1 text-xs font-medium text-sky-200">Premium</span>
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-300/10 text-sky-200">
          <FeatureIcon icon={icon} />
        </div>
        <div>
          <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm leading-relaxed text-slate-300">{description}</p>
        </div>
      </div>
    </article>
  )
}

function ProductShowcase() {
  return (
    <section id="showcase" className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-white/[0.03] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <h2 className={`${sora.className} text-3xl font-semibold tracking-tight text-white md:text-4xl`}>
            See Your Performance at a Glance
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Track win rates, R-multiples, and expectancy. Filter by system, timeframe, or any custom criteria.
          </p>
        </div>

        <div className="relative mx-auto mb-16 max-w-4xl">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#0a1726] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Live Performance Dashboard</h3>
              <span className="rounded-full bg-sky-300/10 px-3 py-1 text-xs font-medium text-sky-200">Real-time</span>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <DashboardStat label="Total Trades" value="145" />
              <DashboardStat label="Win Rate" value="48.3%" highlight />
              <DashboardStat label="Total P&L" value="$651.65" positive />
              <DashboardStat label="Avg Win" value="$2.86" />
              <DashboardStat label="Avg R" value="0.37R" />
              <DashboardStat label="Expectancy" value="2.07" highlight />
            </div>
          </div>
        </div>

        <div className="mb-12 text-center">
          <h3 className={`${sora.className} text-2xl font-semibold tracking-tight text-white md:text-3xl`}>
            Journal Your Thinking as Trades Unfold
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Chart snippets, timestamped notes, and screenshot attachments - capture your full decision-making process.
          </p>
        </div>

        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0a1726] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/8 bg-white/[0.04] px-4 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-rose-300/60" />
              <div className="h-3 w-3 rounded-full bg-amber-300/60" />
              <div className="h-3 w-3 rounded-full bg-sky-300/60" />
            </div>
            <div className="ml-4 flex-1">
              <div className="mx-auto w-64 rounded-md bg-white/[0.05] px-3 py-1 text-center text-xs text-slate-400">
                tradeinsystems.com/trades/114
              </div>
            </div>
          </div>

          <div className="relative">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/tradeinsystems.com_trades%20%283%29-tuy4UZz9qrLhz7yH3AedKGT3FJIWZ4.png"
              alt="Trade Focus view showing TAO trade with TradingView chart snippet, entry stop exit levels, and timestamped thinking discussion with attached screenshots"
              className="w-full"
            />
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-[5%] top-[15%] rounded-lg border-2 border-sky-300 bg-sky-300/90 px-2 py-1 shadow-lg">
                <span className="text-xs font-semibold text-slate-950">Chart Replay</span>
              </div>
              <div className="absolute right-[5%] top-[10%] rounded-lg border-2 border-sky-300 bg-sky-300/90 px-2 py-1 shadow-lg">
                <span className="text-xs font-semibold text-slate-950">Thinking Journal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DashboardStat({
  label,
  value,
  highlight = false,
  positive = false,
}: {
  label: string
  value: string
  highlight?: boolean
  positive?: boolean
}) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-4 text-center">
      <div className={`text-xl font-bold ${highlight ? 'text-sky-200' : positive ? 'text-emerald-200' : 'text-white'}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  )
}

function AIFeatureSection() {
  return (
    <section id="ai" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-1">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/8 px-3 py-1 text-sm text-sky-200">
              <SparkIcon className="h-4 w-4" />
              AI-Powered
            </div>
            <h2 className={`${sora.className} text-3xl font-semibold tracking-tight text-white md:text-4xl`}>
              Screenshot to Trade Entry
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-300">
              Upload or paste a TradingView screenshot and let AI extract the trade details. Symbol, direction, entry price,
              stop loss - all prefilled automatically.
            </p>

            <ul className="mt-8 space-y-4">
              <AIFeatureItem text="Auto-detects direction (LONG/SHORT) from chart" />
              <AIFeatureItem text="Extracts entry, stop loss, and calculates R-Multiple" />
              <AIFeatureItem text="Paste from clipboard with Ctrl+V / Cmd+V" />
              <AIFeatureItem text="Review and edit before saving" />
            </ul>

            <Link
              href="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-sky-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200"
            >
              Try AI Import
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0a1726] shadow-2xl">
            <div className="border-b border-white/8 bg-white/[0.04] px-4 py-3">
              <div className="flex items-center gap-2">
                <SparkIcon className="h-4 w-4 text-sky-200" />
                <span className="text-sm font-medium text-white">Add New Trade - AI Prefill</span>
              </div>
            </div>
            <div className="relative">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/tradeinsystems.com_trades%20%281%29-LBWdnyqHuPyU5NUbRiOI8KbgAdBE1Z.png"
                alt="AI Trade Prefill modal showing upload for AI and paste for AI buttons, auto-detected long direction, system selection, and r-multiple auto-calculation"
                className="w-full"
              />
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[10%] top-[8%] rounded-lg border-2 border-sky-300 bg-sky-300/90 px-2 py-1 shadow-lg">
                  <span className="text-xs font-semibold text-slate-950">AI Prefill Buttons</span>
                </div>
                <div className="absolute right-[10%] top-[28%] rounded-lg border-2 border-sky-300 bg-sky-300/90 px-2 py-1 shadow-lg">
                  <span className="text-xs font-semibold text-slate-950">Auto-detected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function AIFeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-300/10 text-sky-200">
        <CheckIcon className="h-4 w-4" />
      </div>
      <span className="text-slate-300">{text}</span>
    </li>
  )
}

function BacktestingSection() {
  return (
    <section className="rounded-[2rem] border border-white/8 bg-white/[0.03] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-slate-300">
            <LineIcon className="h-4 w-4 text-sky-200" />
            Backtesting
          </div>
          <h2 className={`${sora.className} text-3xl font-semibold tracking-tight text-white md:text-4xl`}>
            Every Trade. Every Detail. Tracked.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Full trade history with system filters, R-multiple calculations, and detailed analytics. Export to CSV anytime.
          </p>
        </div>

        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0a1726] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/8 bg-white/[0.04] px-4 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-rose-300/60" />
              <div className="h-3 w-3 rounded-full bg-amber-300/60" />
              <div className="h-3 w-3 rounded-full bg-sky-300/60" />
            </div>
            <div className="ml-4 flex-1">
              <div className="mx-auto w-64 rounded-md bg-white/[0.05] px-3 py-1 text-center text-xs text-slate-400">
                tradeinsystems.com/trades
              </div>
            </div>
          </div>

          <div className="relative max-h-[500px] overflow-hidden">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/tradeinsystems.com_trades.png-xIXBZyMesnGqb8EkmadwI3yy7gAw6o.jpeg"
              alt="Full trades table showing 145 trades with win rate, P&L, r-multiple columns, system filters, and detailed trade history"
              className="w-full"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a1726] to-transparent" />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <FeatureBadge text="145+ Trades Tracked" />
          <FeatureBadge text="System Filtering" />
          <FeatureBadge text="R-Multiple Analysis" />
          <FeatureBadge text="CSV Export" />
        </div>
      </div>
    </section>
  )
}

function FeatureBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
      <CheckIcon className="h-4 w-4 text-sky-200" />
      {text}
    </div>
  )
}

function PremiumSection({
  isAuthenticated,
  checkoutState,
  requestedFeature,
  monthlyPriceUsd,
  annualPriceUsd,
}: {
  isAuthenticated: boolean
  checkoutState: string | null
  requestedFeature: string | null
  monthlyPriceUsd: number
  annualPriceUsd: number
}) {
  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-1">
        <div className="mb-16 text-center">
          <h2 className={`${sora.className} text-3xl font-semibold tracking-tight text-white md:text-4xl`}>
            Upgrade Your Trading Toolkit
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Start free. Upgrade when you are ready for more systems, AI features, and advanced tools.
          </p>
        </div>

        <PremiumPricingSection
          isAuthenticated={isAuthenticated}
          checkoutState={checkoutState}
          requestedFeature={requestedFeature}
          monthlyPriceUsd={monthlyPriceUsd}
          annualPriceUsd={annualPriceUsd}
        />
      </div>
    </section>
  )
}

function TestimonialsSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-1">
        <div className="mb-16 text-center">
          <h2 className={`${sora.className} text-3xl font-semibold tracking-tight text-white md:text-4xl`}>
            Traders Building Their Edge
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.name} {...testimonial} />
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialCard({ quote, name, role }: { quote: string; name: string; role: string }) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6">
      <div className="mb-4 flex gap-1 text-amber-200">
        {[0, 1, 2, 3, 4].map((index) => (
          <StarIcon key={index} className="h-4 w-4" />
        ))}
      </div>
      <p className="mb-4 text-slate-300">&quot;{quote}&quot;</p>
      <div>
        <div className="font-medium text-white">{name}</div>
        <div className="text-sm text-slate-400">{role}</div>
      </div>
    </article>
  )
}

function CTASection() {
  return (
    <section className="rounded-[2rem] border border-white/8 bg-white/[0.03] py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm">
          <ClockIcon className="h-4 w-4 text-sky-200" />
          <span className="text-slate-300">Start journaling in under 2 minutes</span>
        </div>

        <h2 className={`${sora.className} text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-5xl`}>
          Ready to Build Your Edge?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
          Join thousands of traders who use Trade In Systems to systematically improve their performance.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 sm:w-auto"
          >
            Start Free Journal
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <a
            href="#showcase"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/14 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
          >
            View Live Demo
          </a>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/8 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-1 md:flex-row">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-300 text-slate-950">
            <TrendIcon className="h-4 w-4" />
          </div>
          <span className={`${sora.className} text-lg font-semibold tracking-tight text-white`}>Trade In Systems</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
          <Link href="#features" className="transition-colors hover:text-white">
            Features
          </Link>
          <Link href="#pricing" className="transition-colors hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="transition-colors hover:text-white">
            Log In
          </Link>
          <Link href="/signup" className="transition-colors hover:text-white">
            Start Free
          </Link>
        </div>
      </div>

      <div className="mt-8 border-t border-white/8 pt-8 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} Trade In Systems. All rights reserved.
      </div>
    </footer>
  )
}

function FeatureIcon({ icon }: { icon: (typeof featureCards)[number]['icon'] }) {
  switch (icon) {
    case 'book':
      return <BookIcon className="h-6 w-6" />
    case 'target':
      return <TargetIcon className="h-6 w-6" />
    case 'line':
      return <LineIcon className="h-6 w-6" />
    case 'bars':
      return <BarsIcon className="h-6 w-6" />
    case 'sheet':
      return <SheetIcon className="h-6 w-6" />
    default:
      return <GridIcon className="h-6 w-6" />
  }
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12h14" strokeLinecap="round" />
      <path d="m13 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrendIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-5 w-5'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 16.5 9 11l3 3 8-8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-6 w-6'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 5.5A2.5 2.5 0 0 1 8.5 3H19v17H8.5A2.5 2.5 0 0 0 6 22V5.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 8H16M9.5 12H16M9.5 16H14" strokeLinecap="round" />
    </svg>
  )
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-6 w-6'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
    </svg>
  )
}

function LineIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-6 w-6'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 17c2.5-3.2 4.6-5 6.6-5 1.7 0 2.9 1 4 1 1.8 0 3.2-1.8 5.4-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 7H20v4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BarsIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-6 w-6'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20h16" strokeLinecap="round" />
      <path d="M7 15V9M12 15V5M17 15v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SheetIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-6 w-6'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h8l4 4v14H7z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 3v5h5M9 12h6M9 16h6M9 8h3" strokeLinecap="round" />
    </svg>
  )
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-6 w-6'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </svg>
  )
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-5 w-5'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m12 3 1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m19 14 .8 2 .2.2 2 .8-2 .8-.2.2-.8 2-.8-2-.2-.2-2-.8 2-.8.2-.2.8-2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-5 w-5'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className ?? 'h-4 w-4'} fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z" />
    </svg>
  )
}

function parseUsd(value: string | undefined, fallback: number): number {
  if (!value) return fallback

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}
