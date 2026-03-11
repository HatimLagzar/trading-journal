import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { createNowPaymentsInvoice } from '@/lib/nowpayments';
import { createClient } from '@/lib/supabase/server';
import type { CheckoutPlan } from '@/services/subscription';

type CheckoutRequestBody = {
  plan: CheckoutPlan;
};

type PlanPricing = {
  priceUsd: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const pricing = getPlanPricing();

    if (!body?.plan || !(body.plan in pricing)) {
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

    const headerStore = await headers();
    const origin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL ?? headerStore.get('origin') ?? 'http://localhost:3000');
    const checkoutReference = randomUUID();
    const selectedPricing = pricing[body.plan];

    const invoice = await createNowPaymentsInvoice({
      priceAmount: selectedPricing.priceUsd,
      orderId: checkoutReference,
      orderDescription: `Trade In Systems Premium ${body.plan === 'monthly' ? '3-month' : 'annual'} (USDT TRON)`,
      ipnCallbackUrl: `${origin}/api/crypto/webhook`,
      successUrl: `${origin}/premium/success?checkout=success&provider=crypto`,
      cancelUrl: `${origin}/premium/cancelled?checkout=cancelled&provider=crypto`,
    });

    const { error: insertError } = await supabase.from('crypto_payments').insert({
      user_id: user.id,
      provider: 'nowpayments',
      provider_payment_id: invoice.providerPaymentId,
      checkout_reference: checkoutReference,
      plan: body.plan,
      status: 'waiting',
      price_usd: selectedPricing.priceUsd,
      pay_currency: 'USDT',
      network: 'TRON',
      raw_payload: invoice.raw,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({
      url: invoice.invoiceUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create crypto checkout session';

    if (/amount.*too small|min(imum)?.*amount/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'USDT (TRON) minimum payment is higher than the configured crypto price. Increase NOWPAYMENTS_PREMIUM_THREE_MONTH_PRICE_USD (and annual if needed), then try again.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

function normalizeOrigin(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getPlanPricing(): Record<CheckoutPlan, PlanPricing> {
  const monthlyPriceUsd = parseUsd(
    process.env.NOWPAYMENTS_PREMIUM_THREE_MONTH_PRICE_USD
      ?? process.env.PREMIUM_THREE_MONTH_PRICE_USD
      ?? process.env.NOWPAYMENTS_PREMIUM_TWO_MONTH_PRICE_USD
      ?? process.env.PREMIUM_TWO_MONTH_PRICE_USD
      ?? process.env.NOWPAYMENTS_PREMIUM_MONTHLY_PRICE_USD
      ?? process.env.STRIPE_PREMIUM_MONTHLY_PRICE_USD,
    14.97,
  );
  const annualPriceUsd = parseUsd(
    process.env.NOWPAYMENTS_PREMIUM_ANNUAL_PRICE_USD
      ?? process.env.PREMIUM_ANNUAL_PRICE_USD
      ?? process.env.STRIPE_PREMIUM_ANNUAL_PRICE_USD,
    49.99,
  );

  return {
    monthly: {
      priceUsd: monthlyPriceUsd,
    },
    annual: {
      priceUsd: annualPriceUsd,
    },
  };
}

function parseUsd(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed * 100) / 100;
}
