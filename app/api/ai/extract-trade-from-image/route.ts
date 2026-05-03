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
  screenshot_type?: unknown;
  coin?: unknown;
  direction?: unknown;
  entry?: unknown;
  avg_entry?: unknown;
  stop_loss?: unknown;
  target_price?: unknown;
  avg_exit?: unknown;
  risk?: unknown;
  risk_percentage?: unknown;
  account_size?: unknown;
  r_multiple?: unknown;
  trade_date?: unknown;
  trade_time?: unknown;
  entry_time_source?: unknown;
  entry_time_confidence?: unknown;
  entry_time_reason?: unknown;
};

type ExtractionContext = 'live' | 'backtesting';

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
    const extractionContext = toExtractionContext(formData.get('extraction_context'));

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
      context: extractionContext,
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
  context: ExtractionContext;
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
    context: ExtractionContext;
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
        'X-Title': 'Trade In Systems AI Trade Extractor',
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
                text: buildPrompt(input.context),
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
function buildPrompt(context: ExtractionContext): string {
  const includeTargetPrice = context === 'backtesting';

  const jsonShape = [
    '{',
    '  "direction": "long" | "short" | null,',
    '  "coin": string | null,',
    '  "entry": number | null,',
    '  "stop_loss": number | null,',
    ...(includeTargetPrice ? ['  "target_price": number | null,'] : []),
    '  "trade_date": string | null,',
    '  "trade_time": string | null,',
    '  "entry_time_source": "left_blue_label" | "x_axis_projection" | "candle_count" | null,',
    '  "entry_time_confidence": "high" | "medium" | "low",',
    '  "entry_time_reason": string | null',
    '}',
  ];

  return [
    'You are extracting trade data from a TradingView screenshot.',
    'Use ONLY the single active position tool nearest the most recent candles on the right side of the chart.',
    'Ignore older drawings, unrelated zones, indicators, annotations, and unrelated labels.',
    '',
    'Return ONLY valid JSON:',
    ...jsonShape,
    '',
    'Step 1. Identify the correct position tool:',
    '- A position tool consists of two touching colored zones.',
    '- The shared horizontal border between the zones is the entry line.',
    '- The red zone is the loss zone.',
    '- The green zone is the take-profit zone.',
    '- Use only the active position tool nearest the latest candles on the far right.',
    '',
    'Step 2. Extract prices from geometry only:',
    '- If green is above red, direction = long.',
    '- If red is above green, direction = short.',
    '- entry = exact horizontal split line between red and green.',
    '- stop_loss = exact OUTER boundary of the red zone.',
    includeTargetPrice
      ? '- target_price = exact OUTER boundary of the green zone.'
      : '- Skip target_price extraction for live trade prefill.',
    '- Use right-axis labels only when exactly horizontally aligned with these boundaries.',
    '- Ignore nearby labels that are not exactly aligned.',
    '- Ignore the black current-price label and dotted current-price line.',
    '',
    'Step 3. Extract entry time from x-axis geometry:',
    '- Entry time belongs ONLY to the LEFT vertical boundary of the active position tool.',
    '- First identify the LEFT vertical boundary visually: it is where both green and red zones begin.',
    '- Project that boundary straight down to the bottom time axis.',
    '- If a blue label is directly attached to that same LEFT boundary, use it and set entry_time_source = "left_blue_label".',
    '- Do NOT use any blue label unless its vertical guide/boundary is exactly the same LEFT edge of the position tool.',
    '- If a blue label is centered under the tool, under the right edge, or detached from the left edge, ignore it.',
    '- If no exact label exists, use the candle under the LEFT boundary.',
    '- If the boundary falls between candles, choose the first candle to the right.',
    '- Use visible x-axis labels only as anchors, then count candle intervals from the nearest anchor and set entry_time_source = "candle_count".',
    '- Candle interval must match the visible timeframe from the toolbar.',
    '- If timeframe is not visible, do not interpolate.',
    '- If candle counting requires more than 10 candles from a visible anchor, return null.',
    '- If you project the boundary directly to an axis label without candle counting, set entry_time_source = "x_axis_projection".',
    '- Return null unless the entry time source is visually defensible.',
    '- Always explain the time evidence in entry_time_reason.',
    '',
    'Step 4. Timeframe-aware interpolation (strictly optional):',
    '- Candles are evenly spaced on the x-axis.',
    '- Interpolate time only if timeframe is explicitly visible and spacing is visually reliable.',
    '- If interpolation is ambiguous, return null for trade_date and trade_time, set entry_time_confidence = "low", and explain why.',
    '- If only time is reliable but date is not explicit, return trade_time and set trade_date = null.',
    '',
    'Step 5. Date handling rules:',
    '- trade_time may be inferred from x-axis projection only when visually reliable.',
    '- trade_date requires stronger evidence than trade_time.',
    '- Return trade_date only if date is explicitly visible or clearly tied to entry by visible day/date markers.',
    '- If exact date is not explicit, return trade_date = null.',
    '- Do not convert timezones; return chart-visible time.',
    '- trade_time format must be HH:mm:ss.',
    '- trade_date format must be YYYY-MM-DD when provided.',
    '- entry_time_confidence = "high" only when the LEFT boundary has a directly attached blue label or exact x-axis label.',
    '- entry_time_confidence = "medium" only when candle counting uses the visible timeframe and is within 10 candles of a visible anchor.',
    '- entry_time_confidence = "low" when the time is uncertain; in that case trade_date and trade_time must be null.',
    '',
    'Extraction rules:',
    '- Extract coin from chart header only if clearly visible; return base ticker only (e.g. BTC, ETH, SOL).',
    '- trade_date/trade_time must always refer to ENTRY, never EXIT.',
    '- Time-source priority for trade_date/trade_time: (A) LEFT blue endpoint label, (B) projected LEFT boundary to x-axis, (C) top/header timestamp only if A and B unavailable and clearly tied to entry.',
    '',
    'Hard constraints:',
    '- entry must be the split line between red and green zones.',
    '- entry must NEVER be the black live-price label or dotted current-price line.',
    '- stop_loss must come only from the red-zone outer boundary.',
    '- stop_loss must NEVER come from the green zone.',
    '- for short setups, stop_loss must be above entry.',
    '- for long setups, stop_loss must be below entry.',
    '- if two blue endpoint labels are visible, use LEFT only for trade_date/trade_time.',
    '- never use right/later endpoint timestamp for entry.',
    '- return null instead of guessing when alignment is unclear.',
    includeTargetPrice
      ? '- target_price must come only from the green-zone outer boundary; otherwise null.'
      : '- target_price should be omitted from live extraction output',
    '',
    'Sanity checks before answering:',
    '- For long, stop_loss must be below entry.',
    '- For short, stop_loss must be above entry.',
    '- trade_time must refer to the LEFT vertical boundary where the position tool starts, not the selected range end, not the right edge, not the visible current time.',
    includeTargetPrice
      ? '- target_price must come from the green-zone outer boundary of the same active position tool only.'
      : '- do not infer target_price for live extraction.',
    '- If you cannot confidently map entry time to the LEFT boundary/LEFT blue endpoint, return null for trade_date and trade_time.',
    '- trade_time must refer to the LEFT vertical boundary where the position tool starts only.',
    '- If entry_time_confidence is "low", trade_date and trade_time must be null.',
    '- entry_time_reason must describe the exact visual evidence used for trade_time.',
  ].join("\n");
}

function toExtractionContext(value: FormDataEntryValue | null): ExtractionContext {
  return value === 'backtesting' ? 'backtesting' : 'live';
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
  const avgEntry = toPositiveNumber(payload.entry ?? payload.avg_entry);
  const stopLoss = toPositiveNumber(payload.stop_loss);
  const avgExit = toPositiveNumber(payload.target_price ?? payload.avg_exit);

  let direction: 'long' | 'short' | null = null;
  if (avgEntry !== null && stopLoss !== null && avgEntry !== stopLoss) {
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

  const entryTimeConfidence = normalizeEntryTimeConfidence(payload.entry_time_confidence);
  const tradeDate = entryTimeConfidence === 'low' ? null : normalizeDate(payload.trade_date);
  const tradeTime = entryTimeConfidence === 'low' ? null : normalizeTime(payload.trade_time);

  if (entryTimeConfidence === 'low') {
    computedWarnings.push('Entry time rejected because AI marked the time evidence as low confidence.');
  }

  return {
    fields: {
      coin,
      direction,
      avg_entry: avgEntry,
      stop_loss: stopLoss,
      avg_exit: avgExit,
      risk,
      r_multiple: null,
      trade_date: tradeDate,
      trade_time: tradeTime,
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
  const normalized = value.trim().toUpperCase();
  if (normalized === 'NULL' || normalized === 'N/A' || normalized === 'NA' || normalized === 'NONE' || normalized === 'UNKNOWN') {
    return null;
  }

  const cleaned = normalized.replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return null;
  return cleaned.endsWith('USDT') ? cleaned.slice(0, -4) : cleaned;
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

  const embedded24h = trimmed.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s|$)/);
  if (embedded24h) {
    const hours = Number(embedded24h[1]);
    const minutes = Number(embedded24h[2]);
    const seconds = embedded24h[3] ? Number(embedded24h[3]) : 0;

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }

  const amPmMatch = trimmed.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])(?:\s|$)/);
  if (amPmMatch) {
    const rawHours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2]);
    const seconds = amPmMatch[3] ? Number(amPmMatch[3]) : 0;
    const meridiem = amPmMatch[4].toUpperCase();

    if (rawHours >= 1 && rawHours <= 12 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
      const hours24 = meridiem === 'PM'
        ? (rawHours % 12) + 12
        : rawHours % 12;
      return `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }

  return null;
}

function normalizeEntryTimeConfidence(value: unknown): 'high' | 'medium' | 'low' | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
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
