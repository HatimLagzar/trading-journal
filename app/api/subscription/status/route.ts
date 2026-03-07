import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPremiumSubscription } from '@/lib/subscription';
import { getStripeClient } from '@/lib/stripe';
import type { UserSubscription } from '@/services/subscription';
import type Stripe from 'stripe';

export async function GET() {
  try {
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

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    let subscription = (data ?? null) as UserSubscription | null;

    if (subscription?.stripe_customer_id && !isPremiumSubscription(subscription)) {
      const refreshed = await syncFromStripe(supabase, subscription);
      if (refreshed) {
        subscription = refreshed;
      }
    }

    return NextResponse.json({
      isPremium: isPremiumSubscription(subscription),
      subscription,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch subscription status' },
      { status: 500 },
    );
  }
}

async function syncFromStripe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscription: UserSubscription,
): Promise<UserSubscription | null> {
  try {
    const stripe = getStripeClient();
    const subscriptions = await stripe.subscriptions.list({
      customer: subscription.stripe_customer_id!,
      status: 'all',
      limit: 10,
    });

    const selected = pickMostRelevantSubscription(subscriptions.data);

    if (!selected) return null;

    const status = mapSubscriptionStatus(selected.status);
    const inferredPlan = mapPlanFromSubscription(selected);
    const effectivePlan = status === 'canceled' || status === 'inactive' ? 'free' : inferredPlan;

    const payload = {
      user_id: subscription.user_id,
      stripe_customer_id: subscription.stripe_customer_id,
      stripe_subscription_id: selected.id,
      plan: effectivePlan,
      status,
      current_period_end: getSubscriptionPeriodEnd(selected),
      cancel_at_period_end: selected.cancel_at_period_end,
    };

    const { data, error } = await supabase
      .from('user_subscriptions')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) return null;
    return data as UserSubscription;
  } catch {
    return null;
  }
}

function pickMostRelevantSubscription(items: Stripe.Subscription[]): Stripe.Subscription | null {
  if (items.length === 0) return null;

  const byPriority = [...items].sort((a, b) => {
    const statusDiff = statusPriority(a.status) - statusPriority(b.status);
    if (statusDiff !== 0) return statusDiff;
    return b.created - a.created;
  });

  return byPriority[0] ?? null;
}

function statusPriority(status: Stripe.Subscription.Status): number {
  if (status === 'active') return 1;
  if (status === 'trialing') return 2;
  if (status === 'past_due') return 3;
  if (status === 'unpaid') return 4;
  if (status === 'canceled') return 5;
  return 6;
}

function mapPlanFromSubscription(subscription: Stripe.Subscription): 'premium_monthly' | 'premium_annual' | 'free' {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  if (interval === 'month') return 'premium_monthly';
  if (interval === 'year') return 'premium_annual';
  return 'free';
}

function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): 'inactive' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled') return 'canceled';
  if (status === 'unpaid') return 'unpaid';
  return 'inactive';
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const unixTime = subscription.items.data[0]?.current_period_end;
  if (!unixTime) return null;
  return new Date(unixTime * 1000).toISOString();
}
