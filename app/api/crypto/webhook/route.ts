import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyNowPaymentsSignature } from '@/lib/nowpayments';
import { createAdminClient } from '@/lib/supabase/admin';

type WebhookPayload = {
  payment_id?: unknown;
  payment_status?: unknown;
  order_id?: unknown;
  pay_amount?: unknown;
  pay_currency?: unknown;
  outcome_amount?: unknown;
  actually_paid?: unknown;
  network?: unknown;
  tx_hash?: unknown;
};

type CryptoPaymentRow = {
  user_id: string;
  plan: 'monthly' | 'annual';
  status: string;
};

const SUCCESS_STATUSES = new Set(['confirmed', 'finished']);

export async function POST(request: Request) {
  const body = await request.text();
  const headerStore = await headers();
  const signature = headerStore.get('x-nowpayments-sig');

  try {
    const validSignature = verifyNowPaymentsSignature(body, signature);
    if (!validSignature) {
      return NextResponse.json({ error: 'Invalid NOWPayments signature' }, { status: 401 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'NOWPayments signature verification failed' },
      { status: 500 },
    );
  }

  try {
    const payload = JSON.parse(body) as WebhookPayload;
    const paymentStatus = toLowerCaseString(payload.payment_status);
    const providerPaymentId = toStringValue(payload.payment_id);
    const checkoutReference = toStringValue(payload.order_id);

    if (!paymentStatus || (!providerPaymentId && !checkoutReference)) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const paymentRow = await getPaymentRow({
      providerPaymentId,
      checkoutReference,
      supabase,
    });

    if (!paymentRow) {
      return NextResponse.json({ received: true });
    }

    const rawPayload = payload as Record<string, unknown>;

    const commonUpdate = {
      status: paymentStatus,
      pay_amount: toNumber(payload.pay_amount ?? payload.outcome_amount ?? payload.actually_paid),
      pay_currency: toUpperCaseString(payload.pay_currency),
      network: toUpperCaseString(payload.network),
      tx_hash: toStringValue(payload.tx_hash),
      raw_payload: rawPayload,
    };

    const alreadySuccessful = SUCCESS_STATUSES.has(paymentRow.status);
    const nowSuccessful = SUCCESS_STATUSES.has(paymentStatus);

    if (!nowSuccessful || alreadySuccessful) {
      const { error: updateError } = await supabase
        .from('crypto_payments')
        .update(commonUpdate)
        .eq('provider_payment_id', paymentRow.providerPaymentId);

      if (updateError) throw updateError;

      return NextResponse.json({ received: true });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('current_period_end')
      .eq('user_id', paymentRow.user_id)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;

    const periodStart = resolveRenewalStart(subscription?.current_period_end ?? null);
    const periodEnd = addPlanDuration(periodStart, paymentRow.plan);

    const { error: subscriptionUpsertError } = await supabase
      .from('user_subscriptions')
      .upsert(
        {
          user_id: paymentRow.user_id,
          billing_provider: 'nowpayments',
          plan: paymentRow.plan === 'annual' ? 'premium_annual' : 'premium_monthly',
          status: 'active',
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
        },
        { onConflict: 'user_id' },
      );

    if (subscriptionUpsertError) throw subscriptionUpsertError;

    const { error: paymentUpdateError } = await supabase
      .from('crypto_payments')
      .update({
        ...commonUpdate,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
      })
      .eq('provider_payment_id', paymentRow.providerPaymentId);

    if (paymentUpdateError) throw paymentUpdateError;

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Crypto webhook handler failed' },
      { status: 500 },
    );
  }
}

async function getPaymentRow(input: {
  providerPaymentId: string | null;
  checkoutReference: string | null;
  supabase: ReturnType<typeof createAdminClient>;
}): Promise<(CryptoPaymentRow & { providerPaymentId: string }) | null> {
  const { providerPaymentId, checkoutReference, supabase } = input;

  if (providerPaymentId) {
    const { data, error } = await supabase
      .from('crypto_payments')
      .select('user_id, plan, status, provider_payment_id')
      .eq('provider_payment_id', providerPaymentId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return {
        ...(data as CryptoPaymentRow),
        providerPaymentId: data.provider_payment_id,
      };
    }
  }

  if (!checkoutReference) return null;

  const { data, error } = await supabase
    .from('crypto_payments')
    .select('user_id, plan, status, provider_payment_id')
    .eq('checkout_reference', checkoutReference)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...(data as CryptoPaymentRow),
    providerPaymentId: data.provider_payment_id,
  };
}

function resolveRenewalStart(currentPeriodEnd: string | null): Date {
  if (!currentPeriodEnd) return new Date();

  const parsed = new Date(currentPeriodEnd);
  if (Number.isNaN(parsed.getTime())) return new Date();

  const now = Date.now();
  return parsed.getTime() > now ? parsed : new Date(now);
}

function addPlanDuration(start: Date, plan: 'monthly' | 'annual'): Date {
  const value = new Date(start.getTime());
  if (plan === 'annual') {
    value.setUTCFullYear(value.getUTCFullYear() + 1);
    return value;
  }

  value.setUTCMonth(value.getUTCMonth() + 1);
  return value;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function toLowerCaseString(value: unknown): string | null {
  const normalized = toStringValue(value);
  return normalized ? normalized.toLowerCase() : null;
}

function toUpperCaseString(value: unknown): string | null {
  const normalized = toStringValue(value);
  return normalized ? normalized.toUpperCase() : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
