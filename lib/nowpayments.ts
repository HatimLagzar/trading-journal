import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_NOWPAYMENTS_BASE_URL = 'https://api.nowpayments.io';

type CreateInvoiceInput = {
  priceAmount: number;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
};

type NowPaymentsInvoice = {
  providerPaymentId: string;
  invoiceUrl: string;
  raw: Record<string, unknown>;
};

export function getNowPaymentsBaseUrl(): string {
  return process.env.NOWPAYMENTS_BASE_URL?.trim() || DEFAULT_NOWPAYMENTS_BASE_URL;
}

export function getNowPaymentsApiKey(): string {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing NOWPAYMENTS_API_KEY');
  }

  return apiKey;
}

export function verifyNowPaymentsSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;

  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!ipnSecret) {
    throw new Error('Missing NOWPAYMENTS_IPN_SECRET');
  }

  const expected = createHmac('sha512', ipnSecret).update(payload).digest('hex');
  const canonicalExpected = buildCanonicalPayloadHmac(payload, ipnSecret);
  const incoming = signature.trim().toLowerCase();

  if (incoming.length !== expected.length) {
    return false;
  }

  const incomingBuffer = Buffer.from(incoming);
  const rawMatches = timingSafeEqual(Buffer.from(expected), incomingBuffer);
  if (rawMatches) return true;

  if (!canonicalExpected) return false;
  return timingSafeEqual(Buffer.from(canonicalExpected), incomingBuffer);
}

export async function createNowPaymentsInvoice(input: CreateInvoiceInput): Promise<NowPaymentsInvoice> {
  const response = await fetch(`${getNowPaymentsBaseUrl()}/v1/invoice`, {
    method: 'POST',
    headers: {
      'x-api-key': getNowPaymentsApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: input.priceAmount,
      price_currency: 'usd',
      pay_currency: 'usdcsol',
      order_id: input.orderId,
      order_description: input.orderDescription,
      ipn_callback_url: input.ipnCallbackUrl,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      is_fixed_rate: true,
    }),
  });

  const payload = (await response.json()) as unknown;
  const record = asRecord(payload);

  if (!record) {
    throw new Error('NOWPayments returned an invalid response payload');
  }

  if (!response.ok) {
    const message = typeof record.message === 'string'
      ? record.message
      : 'NOWPayments invoice creation failed';
    throw new Error(message);
  }

  const providerPaymentId = toStringValue(record, ['id', 'payment_id', 'invoice_id']);
  const invoiceUrl = toStringValue(record, ['invoice_url', 'url']);

  if (!providerPaymentId || !invoiceUrl) {
    throw new Error('NOWPayments response missing payment id or invoice URL');
  }

  return {
    providerPaymentId,
    invoiceUrl,
    raw: record,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringValue(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function buildCanonicalPayloadHmac(payload: string, secret: string): string | null {
  try {
    const parsed = JSON.parse(payload) as unknown;
    const canonicalPayload = JSON.stringify(sortObject(parsed));
    return createHmac('sha512', secret).update(canonicalPayload).digest('hex');
  } catch {
    return null;
  }
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sortedEntries = Object.keys(record)
    .sort()
    .map((key) => [key, sortObject(record[key])] as const);

  return Object.fromEntries(sortedEntries);
}
