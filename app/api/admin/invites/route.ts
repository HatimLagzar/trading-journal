import { createHash, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type CreateInviteRequest = {
  expiresInDays?: number;
};

type PremiumInviteRow = {
  id: string;
  created_by: string;
  expires_at: string | null;
  grants_days: number;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
};

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { supabase } = authResult;

    const { data, error } = await supabase
      .from('premium_invites')
      .select('id, created_by, expires_at, grants_days, used_at, used_by, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      invites: (data ?? []) as PremiumInviteRow[],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load invites' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { supabase, userId } = authResult;

    const requestBody = await parseRequestBody(request);
    const inviteToken = createInviteToken();
    const tokenHash = hashInviteToken(inviteToken);
    const inviteDays = getInvitePremiumDays();
    const expiresAt = resolveExpiry(requestBody.expiresInDays);

    const { data, error } = await supabase
      .from('premium_invites')
      .insert({
        token_hash: tokenHash,
        created_by: userId,
        grants_days: inviteDays,
        expires_at: expiresAt,
      })
      .select('id, created_by, expires_at, grants_days, used_at, used_by, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const headerStore = await headers();
    const origin = normalizeOrigin(
      process.env.NEXT_PUBLIC_APP_URL ?? headerStore.get('origin') ?? 'http://localhost:3000',
    );

    return NextResponse.json({
      inviteUrl: `${origin}/invite/${encodeURIComponent(inviteToken)}`,
      invite: data as PremiumInviteRow,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create invite' },
      { status: 500 },
    );
  }
}

async function requireAdmin(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .select('app_role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError.message }, { status: 400 });
  }

  const isAdmin = subscription?.app_role === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return {
    supabase,
    userId: user.id,
  };
}

async function parseRequestBody(request: Request): Promise<CreateInviteRequest> {
  const body = await request.text();
  if (!body.trim()) return {};

  try {
    return JSON.parse(body) as CreateInviteRequest;
  } catch {
    return {};
  }
}

function createInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getInvitePremiumDays(): number {
  const parsed = Number(process.env.INVITE_PREMIUM_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 2;
  }

  return Math.floor(parsed);
}

function resolveExpiry(expiresInDays: number | undefined): string | null {
  if (expiresInDays === undefined || expiresInDays === null) {
    return null;
  }

  if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) {
    return null;
  }

  const days = Math.floor(expiresInDays);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeOrigin(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
