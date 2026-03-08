import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isPremiumSubscription } from '@/lib/subscription';

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

type ExtractedFields = {
  coin: string | null;
  direction: 'long' | 'short' | null;
  avg_entry: number | null;
  stop_loss: number | null;
  avg_exit: number | null;
  risk: number | null;
  r_multiple: number | null;
  trade_date: string | null;
  trade_time: string | null;
  notes: null;
};

type GeminiExtractionPayload = {
  coin?: unknown;
  direction?: unknown;
  avg_entry?: unknown;
  stop_loss?: unknown;
  avg_exit?: unknown;
  risk?: unknown;
  risk_percentage?: unknown;
  account_size?: unknown;
  r_multiple?: unknown;
  trade_date?: unknown;
  trade_time?: unknown;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 });
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

    const { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subscriptionError) {
      return NextResponse.json({ error: subscriptionError.message }, { status: 400 });
    }

    if (!isPremiumSubscription(subscription ?? null)) {
      return NextResponse.json({ error: 'Premium subscription required' }, { status: 403 });
    }

    const formData = await request.formData();
    const image = formData.get('image');

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(image.type)) {
      return NextResponse.json({ error: 'Unsupported image type. Use PNG, JPG, or WEBP.' }, { status: 400 });
    }

    if (image.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image is too large. Max 8MB.' }, { status: 400 });
    }

    const imageBytes = await image.arrayBuffer();
    const imageBase64 = Buffer.from(imageBytes).toString('base64');
    const configuredModels = (
      process.env.OPENROUTER_VISION_MODELS
      || process.env.OPENROUTER_QWEN_MODELS
      || process.env.OPENROUTER_QWEN_MODEL
      || ''
    )
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const candidateModels = configuredModels.length > 0
      ? configuredModels
      : ['qwen/qwen3-vl-8b-instruct'];

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const extractionResult = await requestOpenRouterExtraction({
      apiKey,
      appUrl,
      models: candidateModels,
      imageMimeType: image.type,
      imageBase64,
    });

    if (!extractionResult.ok) {
      return NextResponse.json({ error: extractionResult.error }, { status: 400 });
    }

    const openRouterPayload = extractionResult.payload;
    const rawJson = extractOpenRouterText(openRouterPayload);
    if (!rawJson) {
      return NextResponse.json({ error: 'AI could not read this screenshot' }, { status: 422 });
    }

    const parsed = parseExtractionJson(rawJson);
    const { fields, computedWarnings } = sanitizeFields(parsed);
    const warnings = computedWarnings;

    return NextResponse.json({
      fields,
      warnings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to extract trade data from screenshot' },
      { status: 500 },
    );
  }
}

async function requestOpenRouterExtraction(input: {
  apiKey: string;
  appUrl: string;
  models: string[];
  imageMimeType: string;
  imageBase64: string;
}): Promise<{ ok: true; payload: unknown } | { ok: false; error: string }> {
  const modelErrors: string[] = [];

  for (let index = 0; index < input.models.length; index += 1) {
    const model = input.models[index];

    const response = await requestModelWithRetry(input, model);

    if (response.ok) {
      const payload = await response.json();
      return { ok: true, payload };
    }

    const errorText = await response.text();
    modelErrors.push(`- ${model}: ${errorText}`);
  }

  return {
    ok: false,
    error: `All configured OpenRouter models failed. Set OPENROUTER_QWEN_MODELS to models available on your account.\n${modelErrors.join('\n')}`,
  };
}

async function requestModelWithRetry(
  input: {
    apiKey: string;
    appUrl: string;
    imageMimeType: string;
    imageBase64: string;
  },
  model: string,
) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': input.appUrl,
        'X-Title': 'Trading Journal AI Trade Extractor',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: {
          type: 'json_object',
        },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: buildPrompt(),
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${input.imageMimeType};base64,${input.imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (response.status !== 429 || attempt === maxAttempts) {
      return response;
    }

    await sleep(1500 * attempt);
  }

  throw new Error('Unreachable');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(): string {
  return [
    'You are an expert TradingView trade screenshot parser.',
    'Your input is ONE screenshot, and it will be exactly one of these types:',
    'Type A: Position tool settings/input panel screenshot',
    'Type B: Chart screenshot with a TradingView long/short position box',
    'Return ONLY valid JSON with this exact shape:',
    '{',
    '  "screenshot_type": "panel" | "chart" | null,',
    '  "coin": string|null,',
    '  "direction": "long"|"short"|null,',
    '  "avg_entry": number|null,',
    '  "stop_loss": number|null,',
    '  "avg_exit": number|null,',
    '  "risk": number|null,',
    '  "risk_percentage": number|null,',
    '  "account_size": number|null,',
    '  "r_multiple": number|null,',
    '  "trade_date": string|null,',
    '  "trade_time": string|null,',
    '  "notes": null',
    '}',
    'Rules:',
    '- Return JSON only.',
    '- Do not hallucinate.',
    '- If a field is missing or not reliably inferable, return null.',
    '- Return numbers as JSON numbers only (no %, $, commas, or strings).',
    '- notes must always be null.',
    '- coin must be base asset ticker only, e.g. BTC, ETH, SOL, TAO.',
    '- trade_date must be YYYY-MM-DD when explicitly visible.',
    '- trade_time must be HH:mm:ss in UTC when explicitly visible.',
    '- If exact trade date/time is not visible, return null for those fields.',
    '- Only return avg_exit if the screenshot indicates the trade has actually reached/closed at target AFTER entry time; otherwise set avg_exit to null.',
    'Branching logic:',
    '1) Detect screenshot type',
    '- If the screenshot shows a TradingView settings/input panel with fields like Account size, Risk, Entry price, Profit level, Stop level, set screenshot_type = "panel".',
    '- If the screenshot shows the chart with the long/short position box, set screenshot_type = "chart".',
    '2) For panel screenshots',
    '- Read explicit numeric values directly from visible fields.',
    '- avg_entry = Entry price.',
    '- avg_exit = Profit level price if visible.',
    '- stop_loss = Stop level price if visible.',
    '- account_size = Account size if visible.',
    '- risk_percentage = Risk if shown as %.',
    '- If account_size and risk_percentage are both visible, compute risk = account_size * (risk_percentage / 100).',
    '- Determine direction: if profit level price > entry price and stop level price < entry price => long; if profit level price < entry price and stop level price > entry price => short.',
    '- r_multiple: if profit level and stop level and entry are visible, compute for long: (avg_exit - avg_entry) / (avg_entry - stop_loss), for short: (avg_entry - avg_exit) / (stop_loss - avg_entry).',
    '- If denominator is zero or negative, return r_multiple as null.',
    '3) For chart screenshots',
    '- Extract coin from chart header if visible.',
    '- Infer direction from position box: target above and stop below => long; target below and stop above => short.',
    '- Read price values primarily from the right price axis labels when they are visible.',
    '- In chart screenshots, the right-axis labels are color-coded: entry in gray, stop loss in red, take profit in green.',
    '- avg_entry = gray right-axis label (or boundary where target and stop zones meet if label is absent).',
    '- stop_loss = red right-axis label (or outer boundary of red stop zone if label is absent).',
    '- avg_exit = green right-axis label only when there is clear visual evidence target was hit after entry (for example hit markers, closed position labels, or candle movement through target after entry). Otherwise return null.',
    '- Only fill account_size, risk_percentage, risk, and r_multiple if explicitly visible in screenshot.',
    '- Do not compute account metrics from chart geometry alone.',
    '4) Prioritize explicit labels over visual estimation.',
    '5) If a value is partially cut off or ambiguous, return null.',
  ].join('\n');
}

function extractOpenRouterText(payload: unknown): string | null {
  const response = payload as OpenRouterResponse;
  const text = response.choices?.[0]?.message?.content;

  if (typeof text === 'string') {
    const trimmed = text.trim();
    return trimmed || null;
  }

  if (Array.isArray(text)) {
    const joined = text
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    return joined || null;
  }

  return null;
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
};

function parseExtractionJson(rawText: string): GeminiExtractionPayload | null {
  try {
    return JSON.parse(rawText) as GeminiExtractionPayload;
  } catch {
    const fenced = rawText.match(/\{[\s\S]*\}/);
    if (!fenced) return null;

    try {
      return JSON.parse(fenced[0]) as GeminiExtractionPayload;
    } catch {
      return null;
    }
  }
}

function sanitizeFields(payload: GeminiExtractionPayload | null): {
  fields: ExtractedFields;
  computedWarnings: string[];
} {
  if (!payload) {
    return {
      fields: emptyFields(),
      computedWarnings: [],
    };
  }

  const coin = normalizeCoin(payload.coin);
  const avgEntry = toPositiveNumber(payload.avg_entry);
  const stopLoss = toPositiveNumber(payload.stop_loss);
  const avgExit = toPositiveNumber(payload.avg_exit);

  let direction = normalizeDirection(payload.direction);
  if (!direction && avgEntry !== null && stopLoss !== null) {
    direction = avgEntry > stopLoss ? 'long' : 'short';
  }

  const computedWarnings: string[] = [];
  let risk = toPositiveNumber(payload.risk);

  if (risk === null) {
    const riskPct = toPercentage(payload.risk_percentage ?? payload.risk);
    const accountSize = toPositiveNumber(payload.account_size);

    if (riskPct !== null && accountSize !== null) {
      risk = roundToTwo(accountSize * (riskPct / 100));
      computedWarnings.push(`Risk computed from ${riskPct}% of account size ${accountSize}.`);
    }
  }

  return {
    fields: {
      coin,
      direction,
      avg_entry: avgEntry,
      stop_loss: stopLoss,
      avg_exit: avgExit,
      risk,
      r_multiple: toNumber(payload.r_multiple),
      trade_date: normalizeDate(payload.trade_date),
      trade_time: normalizeTime(payload.trade_time),
      notes: null,
    },
    computedWarnings,
  };
}

function emptyFields(): ExtractedFields {
  return {
    coin: null,
    direction: null,
    avg_entry: null,
    stop_loss: null,
    avg_exit: null,
    risk: null,
    r_multiple: null,
    trade_date: null,
    trade_time: null,
    notes: null,
  };
}

function normalizeCoin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return null;
  return cleaned.endsWith('USDT') ? cleaned.slice(0, -4) : cleaned;
}

function normalizeDirection(value: unknown): 'long' | 'short' | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  if (cleaned === 'long' || cleaned === 'short') return cleaned;
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getUTCFullYear();
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hhmm = trimmed.match(/^(\d{2}):(\d{2})$/);
  if (hhmm) {
    return `${hhmm[1]}:${hhmm[2]}:00`;
  }

  const hhmmss = trimmed.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (hhmmss) {
    return `${hhmmss[1]}:${hhmmss[2]}:${hhmmss[3]}`;
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed === null || parsed <= 0) return null;
  return parsed;
}

function toPercentage(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const cleaned = trimmed.replace('%', '').replace(/,/g, '').trim();
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) return null;
    return parsed;
  }

  return null;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
