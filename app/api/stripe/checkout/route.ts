import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe';
import type { CheckoutPlan } from '@/services/subscription';

type CheckoutRequestBody = {
  plan: CheckoutPlan;
};

type PlanConfig = {
  priceId: string;
  planCode: 'premium_monthly' | 'premium_annual';
};

export async function POST(request: Request) {
  try {
    const planConfigByType = getPlanConfig();
    const body = (await request.json()) as CheckoutRequestBody;
    if (!body?.plan || !(body.plan in planConfigByType)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

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

    const stripe = getStripeClient();
    const planConfig = planConfigByType[body.plan];

    const { data: existingSubscription, error: existingSubscriptionError } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSubscriptionError) {
      return NextResponse.json({ error: existingSubscriptionError.message }, { status: 400 });
    }

    let customerId = existingSubscription?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    const upsertPayload = {
      user_id: user.id,
      billing_provider: 'stripe',
      stripe_customer_id: customerId,
      plan: 'free',
      status: 'inactive',
    };

    const { error: upsertError } = await supabase
      .from('user_subscriptions')
      .upsert(upsertPayload, { onConflict: 'user_id' });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 });
    }

    const headerStore = await headers();
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? headerStore.get('origin') ?? 'http://localhost:3000';

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      success_url: `${origin}/premium/success`,
      cancel_url: `${origin}/premium/cancelled`,
      line_items: [
        {
          quantity: 1,
          price: planConfig.priceId,
        },
      ],
      allow_promotion_codes: true,
      metadata: {
        user_id: user.id,
        plan: planConfig.planCode,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: planConfig.planCode,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}

function getPlanConfig(): Record<CheckoutPlan, PlanConfig> {
  const monthlyPriceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
  const annualPriceId = process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID;

  if (!monthlyPriceId || !annualPriceId) {
    throw new Error('Missing Stripe price ids. Set STRIPE_PREMIUM_MONTHLY_PRICE_ID and STRIPE_PREMIUM_ANNUAL_PRICE_ID');
  }

  return {
    monthly: {
      priceId: monthlyPriceId,
      planCode: 'premium_monthly',
    },
    annual: {
      priceId: annualPriceId,
      planCode: 'premium_annual',
    },
  };
}
