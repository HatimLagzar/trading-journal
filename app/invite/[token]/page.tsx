import Link from 'next/link';

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const normalizedToken = token.trim();
  const signupHref = normalizedToken.length > 0
    ? `/signup?invite=${encodeURIComponent(normalizedToken)}`
    : '/signup';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl">
        <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">
          Premium Invite
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white">You are invited to try Premium</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Create your account using this invite link and you will get a free Premium trial automatically.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={signupHref}
            className="rounded-lg border border-cyan-500/70 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
          >
            Create Account
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </main>
  );
}
