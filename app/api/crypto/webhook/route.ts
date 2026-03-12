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
  network_fee?: unknown;
  service_fee?: unknown;
  fee?: unknown;
  network?: unknown;
  tx_hash?: unknown;
};

type CryptoPaymentRow = {
  user_id: string;
  plan: 'monthly' | 'annual';
  status: string;
  period_end: string | null;
  pay_amount: number | null;
};

const SUCCESS_EVENT_STATUSES = new Set(['finished']);
const ALREADY_SUCCESSFUL_STATUSES = new Set(['finished', 'partially_paid_accepted', 'confirmed']);
const PARTIAL_PAID_STATUSES = new Set(['partially_paid', 'partially-paid', 'partially paid']);

type SettlementDecision = {
  action: 'accept' | 'review' | 'reject' | 'pending';
  status: string;
  reason: string;
  shortfall: number | null;
};

export async function POST(request: Request) {
  const body = await request.text();
  const headerStore = await headers();
  const signature = headerStore.get('x-nowpayments-sig') ?? headerStore.get('x-nowpayments-signature');

  try {
    const validSignature = verifyNowPaymentsSignature(body, signature);
    if (!validSignature) {
      console.error('[crypto-webhook] Invalid NOWPayments signature', {
        hasSignature: Boolean(signature),
        bodySize: body.length,
      });
      return NextResponse.json({ error: 'Invalid NOWPayments signature' }, { status: 401 });
    }
  } catch (err) {
    console.error('[crypto-webhook] Signature verification failed', {
      error: err instanceof Error ? err.message : 'unknown',
      hasSignature: Boolean(signature),
    });
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
      console.error('[crypto-webhook] Missing payment fields', {
        paymentStatus,
        hasProviderPaymentId: Boolean(providerPaymentId),
        hasCheckoutReference: Boolean(checkoutReference),
      });
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 });
    }

    console.info('[crypto-webhook] Received event', {
      paymentStatus,
      providerPaymentId,
      checkoutReference,
    });

    const supabase = createAdminClient();

    const paymentRow = await getPaymentRow({
      providerPaymentId,
      checkoutReference,
      supabase,
    });

    if (!paymentRow) {
      console.warn('[crypto-webhook] Payment row not found for event', {
        providerPaymentId,
        checkoutReference,
      });
      return NextResponse.json({ received: true });
    }

    const rawPayload = payload as Record<string, unknown>;

    const expectedAmount = toNumber(payload.pay_amount ?? payload.outcome_amount) ?? paymentRow.pay_amount;
    const actuallyPaid = toNumber(payload.actually_paid);
    const settlementDecision = evaluateSettlement({
      paymentStatus,
      expectedAmount,
      actuallyPaid,
    });
    const nowSuccessful = settlementDecision.action === 'accept';
    const effectiveStatus = settlementDecision.status;

    const commonUpdate = {
      status: effectiveStatus,
      pay_amount: expectedAmount,
      pay_currency: toUpperCaseString(payload.pay_currency),
      network: toUpperCaseString(payload.network),
      tx_hash: toStringValue(payload.tx_hash),
      raw_payload: rawPayload,
    };

    const alreadySuccessful = ALREADY_SUCCESSFUL_STATUSES.has(paymentRow.status) || Boolean(paymentRow.period_end);

    if (!nowSuccessful || alreadySuccessful) {
      const { error: updateError } = await supabase
        .from('crypto_payments')
        .update(commonUpdate)
        .eq('provider_payment_id', paymentRow.providerPaymentId);

      if (updateError) throw updateError;

      console.info('[crypto-webhook] Non-success or duplicate success event processed', {
        paymentStatus,
        settlementAction: settlementDecision.action,
        settlementReason: settlementDecision.reason,
        shortfall: settlementDecision.shortfall,
        alreadySuccessful,
        providerPaymentId: paymentRow.providerPaymentId,
      });

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

    console.info('[crypto-webhook] Subscription activated from crypto payment', {
      userId: paymentRow.user_id,
      plan: paymentRow.plan,
      paymentStatus,
      settlementAction: settlementDecision.action,
      settlementReason: settlementDecision.reason,
      shortfall: settlementDecision.shortfall,
      periodEnd: periodEnd.toISOString(),
      providerPaymentId: paymentRow.providerPaymentId,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[crypto-webhook] Handler failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
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
      .select('user_id, plan, status, period_end, pay_amount, provider_payment_id')
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
    .select('user_id, plan, status, period_end, pay_amount, provider_payment_id')
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

  value.setUTCMonth(value.getUTCMonth() + 3);
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

function evaluateSettlement(input: {
  paymentStatus: string;
  expectedAmount: number | null;
  actuallyPaid: number | null;
}): SettlementDecision {
  if (SUCCESS_EVENT_STATUSES.has(input.paymentStatus)) {
    return {
      action: 'accept',
      status: 'finished',
      reason: 'provider_finished',
      shortfall: null,
    };
  }

  if (!PARTIAL_PAID_STATUSES.has(input.paymentStatus)) {
    return {
      action: 'pending',
      status: input.paymentStatus,
      reason: 'non_terminal_status',
      shortfall: null,
    };
  }

  if (input.expectedAmount === null || input.actuallyPaid === null) {
    return {
      action: 'review',
      status: 'pending_manual_review',
      reason: 'missing_amounts',
      shortfall: null,
    };
  }

  if (input.expectedAmount <= 0 || input.actuallyPaid <= 0) {
    return {
      action: 'reject',
      status: 'underpaid_rejected',
      reason: 'invalid_amounts',
      shortfall: null,
    };
  }

  const shortfall = input.expectedAmount - input.actuallyPaid;
  if (shortfall <= 0) {
    return {
      action: 'accept',
      status: 'finished',
      reason: 'partial_with_no_shortfall',
      shortfall,
    };
  }

  const autoTolerance = Math.max(getAutoToleranceFlat(), input.expectedAmount * getAutoTolerancePercent());
  if (shortfall <= autoTolerance) {
    return {
      action: 'accept',
      status: 'finished',
      reason: 'shortfall_within_auto_tolerance',
      shortfall,
    };
  }

  const manualReviewTolerance = Math.max(getManualReviewFlat(), input.expectedAmount * getManualReviewPercent());
  if (shortfall <= manualReviewTolerance) {
    return {
      action: 'review',
      status: 'pending_manual_review',
      reason: 'shortfall_requires_manual_review',
      shortfall,
    };
  }

  return {
    action: 'reject',
    status: 'underpaid_rejected',
    reason: 'shortfall_above_rejection_threshold',
    shortfall,
  };
}

function getAutoToleranceFlat(): number {
  return parseNonNegative(process.env.NOWPAYMENTS_AUTO_TOLERANCE_FLAT, 0.02);
}

function getAutoTolerancePercent(): number {
  return parseNonNegative(process.env.NOWPAYMENTS_AUTO_TOLERANCE_PERCENT, 0.0035);
}

function getManualReviewFlat(): number {
  return parseNonNegative(process.env.NOWPAYMENTS_REVIEW_TOLERANCE_FLAT, 0.06);
}

function getManualReviewPercent(): number {
  return parseNonNegative(process.env.NOWPAYMENTS_REVIEW_TOLERANCE_PERCENT, 0.01);
}

function parseNonNegative(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}
