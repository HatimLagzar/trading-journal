import Link from 'next/link';
import AuthNavbar from '@/app/components/AuthNavbar';

export default function PremiumCancelledPage() {
  return (
    <div className="min-h-screen bg-[#f4f7f9] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <AuthNavbar current="premium" />

        <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-amber-200 bg-white p-8 shadow-sm sm:p-10">
        <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
          Checkout not completed
        </p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
          No worries, your plan was not charged
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          You can continue on free and upgrade when ready. Premium features remain visible so you can
          evaluate exactly what you unlock before subscribing.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Premium benefits include:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Screenshot uploads</li>
            <li>Image attachments in Decisions discussions (including paste)</li>
            <li>Live trade imports</li>
            <li>Mirroring live trades to backtesting sessions</li>
            <li>Creating more than 2 systems</li>
          </ul>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/premium"
            className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try Checkout Again
          </Link>
          <Link
            href="/trades"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Trades
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
