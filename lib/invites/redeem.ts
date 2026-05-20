import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

type SubscriptionRow = {
  plan: string
  status: string
  current_period_end: string | null
}

type RedeemInviteForUserParams = {
  userId: string
  createdAt: string | null | undefined
  userMetadata: unknown
}

type RedeemInviteResult = {
  redeemed: boolean
  reason?: string
  trialEndsAt?: string
  startsAt?: string
}

export async function redeemInviteForUser({ userId, createdAt, userMetadata }: RedeemInviteForUserParams): Promise<RedeemInviteResult> {
  const inviteToken = getInviteToken(userMetadata)
  if (!inviteToken) {
    return { redeemed: false, reason: 'no_invite_token' }
  }

  const signupTime = parseDate(createdAt, null) ?? new Date()
  const signupTimeIso = signupTime.toISOString()
  const adminSupabase = createAdminClient()
  const tokenHash = createHash('sha256').update(inviteToken).digest('hex')

  const { data: invite, error: inviteError } = await adminSupabase
    .from('premium_invites')
    .select('id, grants_days, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (inviteError) {
    throw new Error(inviteError.message)
  }

  if (!invite) {
    await clearInviteToken(adminSupabase, userId, userMetadata)
    return { redeemed: false, reason: 'invalid_invite' }
  }

  if (invite.used_at) {
    await clearInviteToken(adminSupabase, userId, userMetadata)
    return { redeemed: false, reason: 'invite_already_used' }
  }

  if (invite.expires_at) {
    const expiryTime = parseDate(invite.expires_at, null)
    if (expiryTime && expiryTime.getTime() <= signupTime.getTime()) {
      await clearInviteToken(adminSupabase, userId, userMetadata)
      return { redeemed: false, reason: 'invite_expired' }
    }
  }

  const { data: claimedInvite, error: claimError } = await adminSupabase
    .from('premium_invites')
    .update({
      used_at: signupTimeIso,
      used_by: userId,
    })
    .eq('id', invite.id)
    .is('used_at', null)
    .select('id, grants_days')
    .maybeSingle()

  if (claimError) {
    throw new Error(claimError.message)
  }

  if (!claimedInvite) {
    await clearInviteToken(adminSupabase, userId, userMetadata)
    return { redeemed: false, reason: 'invite_already_used' }
  }

  const inviteDays = normalizeInviteDays(claimedInvite.grants_days)
  const invitePeriodEnd = new Date(signupTime.getTime() + inviteDays * 24 * 60 * 60 * 1000)

  const { data: currentSubscription, error: currentSubscriptionError } = await adminSupabase
    .from('user_subscriptions')
    .select('plan, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()

  if (currentSubscriptionError) {
    throw new Error(currentSubscriptionError.message)
  }

  const existingPeriodEnd = parseDate(currentSubscription?.current_period_end ?? null, null)
  const nextPeriodEnd = existingPeriodEnd && existingPeriodEnd.getTime() > invitePeriodEnd.getTime()
    ? existingPeriodEnd
    : invitePeriodEnd

  const currentPremium = isPremiumSubscription(currentSubscription ?? null)

  if (!currentPremium || !existingPeriodEnd || existingPeriodEnd.getTime() < nextPeriodEnd.getTime()) {
    const { error: upsertError } = await adminSupabase
      .from('user_subscriptions')
      .upsert(
        {
          user_id: userId,
          billing_provider: 'none',
          plan: 'premium_monthly',
          status: 'trialing',
          current_period_end: nextPeriodEnd.toISOString(),
          cancel_at_period_end: false,
        },
        { onConflict: 'user_id' },
      )

    if (upsertError) {
      throw new Error(upsertError.message)
    }
  }

  await clearInviteToken(adminSupabase, userId, userMetadata)

  return {
    redeemed: true,
    trialEndsAt: nextPeriodEnd.toISOString(),
    startsAt: signupTimeIso,
  }
}

function getInviteToken(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }

  const value = (metadata as Record<string, unknown>).invite_token
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseDate(value: string | null | undefined, fallback: Date | null): Date | null {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }

  return parsed
}

function normalizeInviteDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) {
    return 15
  }

  return Math.floor(days)
}

function isPremiumSubscription(subscription: SubscriptionRow | null): boolean {
  if (!subscription) return false

  const activeStatus = subscription.status === 'active' || subscription.status === 'trialing'
  if (!activeStatus) return false

  const paidPlan = subscription.plan === 'premium_monthly' || subscription.plan === 'premium_annual'
  if (!paidPlan) return false

  if (!subscription.current_period_end) return true
  return new Date(subscription.current_period_end).getTime() > Date.now()
}

async function clearInviteToken(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
  metadata: unknown,
): Promise<void> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return
  }

  const record = metadata as Record<string, unknown>
  if (!('invite_token' in record)) {
    return
  }

  const nextMetadata = { ...record }
  delete nextMetadata.invite_token

  await adminSupabase.auth.admin.updateUserById(userId, {
    user_metadata: nextMetadata,
  })
}
