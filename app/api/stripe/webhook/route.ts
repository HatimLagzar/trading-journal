import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe';

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signingSecret) {
    return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 });
  }

  const headerStore = await headers();
  const signature = headerStore.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, signingSecret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook signature verification failed' },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook handler failed' },
      { status: 500 },
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return;

  const stripe = getStripeClient();
  const supabase = createAdminClient();

  const subscriptionId = asId(session.subscription);
  const customerId = asId(session.customer);

  if (!subscriptionId || !customerId) return;

  let userId = session.metadata?.user_id ?? null;
  const planCode = mapPlanCode(session.metadata?.plan);

  if (!userId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!('deleted' in customer)) {
      userId = customer.metadata.user_id ?? null;
    }
  }

  if (!userId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const mappedPlan = mapPlanFromSubscription(subscription);
  const finalPlan = mappedPlan ?? planCode;

  const { error } = await supabase.from('user_subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan: finalPlan,
      status: mapSubscriptionStatus(subscription.status),
      current_period_end: getSubscriptionPeriodEnd(subscription),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: 'user_id' },
  );

  if (error) throw error;
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createAdminClient();
  const customerId = asId(subscription.customer);
  const subscriptionId = subscription.id;

  const mappedPlan = mapPlanFromSubscription(subscription);
  const plan = mappedPlan ?? 'free';

  const { data: existingBySubscription, error: lookupBySubscriptionError } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (lookupBySubscriptionError) throw lookupBySubscriptionError;

  let userId = existingBySubscription?.user_id ?? null;

  if (!userId && customerId) {
    const { data: existingByCustomer, error: lookupByCustomerError } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    if (lookupByCustomerError) throw lookupByCustomerError;
    userId = existingByCustomer?.user_id ?? null;
  }

  if (!userId) {
    userId = subscription.metadata.user_id ?? null;
  }

  if (!userId) return;

  const status = mapSubscriptionStatus(subscription.status);
  const effectivePlan = status === 'canceled' || status === 'inactive' ? 'free' : plan;

  const { error } = await supabase.from('user_subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan: effectivePlan,
      status,
      current_period_end: getSubscriptionPeriodEnd(subscription),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: 'user_id' },
  );

  if (error) throw error;
}

function mapPlanCode(value: string | undefined): 'premium_monthly' | 'premium_annual' | 'free' {
  if (value === 'premium_monthly' || value === 'premium_annual') return value;
  return 'free';
}

function mapPlanFromSubscription(subscription: Stripe.Subscription): 'premium_monthly' | 'premium_annual' | null {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  if (interval === 'month') return 'premium_monthly';
  if (interval === 'year') return 'premium_annual';
  return null;
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

function asId(
  value:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | Stripe.Subscription
    | null,
): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return 'id' in value ? value.id : null;
}
