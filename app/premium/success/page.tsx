import Link from 'next/link';
import AuthNavbar from '@/app/components/AuthNavbar';

export default function PremiumSuccessPage() {
  return (
    <div className="min-h-screen bg-[#f4f7f9] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <AuthNavbar current="premium" />

        <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm sm:p-10">
        <p className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Payment successful
        </p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
          Welcome to Premium
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          Your subscription is being activated. This usually happens in seconds after Stripe sends the webhook.
          If access does not update right away, refresh in a moment.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">You can now unlock:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Screenshot uploads on trades</li>
            <li>Image attachments in Decisions discussions (including paste)</li>
            <li>Live trade imports</li>
            <li>Live-to-backtesting mirroring</li>
            <li>More than 2 systems</li>
          </ul>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/trades"
            className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            Go to Trades
          </Link>
          <Link
            href="/premium"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Premium
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
