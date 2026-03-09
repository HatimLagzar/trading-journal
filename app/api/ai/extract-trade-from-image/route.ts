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

  const extractionFields = includeTargetPrice
    ? [
      '- direction',
      '- coin',
      '- entry',
      '- stop_loss',
      '- target_price',
      '- trade_date',
      '- trade_time',
    ]
    : [
      '- direction',
      '- coin',
      '- entry',
      '- stop_loss',
      '- trade_date',
      '- trade_time',
    ];

  const jsonShape = includeTargetPrice
    ? [
      '{',
      '  "direction": "long" | "short" | null,',
      '  "coin": string | null,',
      '  "entry": number | null,',
      '  "stop_loss": number | null,',
      '  "target_price": number | null,',
      '  "trade_date": string | null,',
      '  "trade_time": string | null',
      '}',
    ]
    : [
      '{',
      '  "direction": "long" | "short" | null,',
      '  "coin": string | null,',
      '  "entry": number | null,',
      '  "stop_loss": number | null,',
      '  "trade_date": string | null,',
      '  "trade_time": string | null',
      '}',
    ];

  return [
    'The image contains a TradingView chart region focused on the active position tool near the latest candles on the right side, plus the right-side price axis.',
    'It may still include other chart drawings, indicators, labels, and lines. Ignore them unless they belong to the active position tool.',
    '',
    'Extract ONLY:',
    ...extractionFields,
    '',
    'Return ONLY valid JSON:',
    ...jsonShape,
    '',
    'Primary object to parse:',
    '- Parse ONLY the single active TradingView position tool nearest the latest candles on the far right side of the chart.',
    '- Do not parse any older drawings, unrelated zones, indicator levels, or horizontal lines elsewhere on the chart.',
    '',
    'Definitions of the TradingView position tool:',
    '- The active position tool has exactly two colored zones that touch each other.',
    '- The horizontal border where the two colored zones touch is the entry line.',
    '- The red zone is always the loss zone.',
    '- The green zone is always the take-profit zone.',
    '- stop_loss always comes from the RED zone, never from the green zone.',
    '',
    'Direction teaching:',
    '- If the red zone is ABOVE the green zone, direction = short.',
    '- If the green zone is ABOVE the red zone, direction = long.',
    '- Determine direction from zone order only, before reading any prices.',
    '',
    'Critical current-price teaching:',
    '- On TradingView, the black right-axis label attached to the dotted horizontal line is the CURRENT MARKET PRICE.',
    '- The black current-price label is NEVER the entry.',
    '- The dotted horizontal line is NEVER the entry.',
    '- If both a black label and a gray label are near the tool, ignore the black label for entry extraction.',
    '',
    'Critical entry teaching:',
    '- entry must come from the split line between the red and green zones of the active position tool.',
    '- If a gray right-axis label is horizontally aligned with that split line, that gray label MUST be used as entry.',
    '- If no explicit gray split-line label exists, estimate entry by projecting the split line horizontally to the right axis ticks.',
    '',
    'Critical stop-loss teaching:',
    '- stop_loss must come only from the OUTER EDGE OF THE RED ZONE of the same active position tool.',
    '- For a SHORT setup, red is above green, so stop_loss = TOP edge of the red zone and must be ABOVE entry.',
    '- For a LONG setup, green is above red, so stop_loss = BOTTOM edge of the red zone and must be BELOW entry.',
    '- The green zone boundary must never be used as stop_loss.',
    '- Any label above or below the active red-zone boundary that does not exactly align with that boundary must be ignored.',
    '',
    'Projection and label-reading procedure:',
    '1. Locate the active position tool nearest the latest candles on the right side.',
    '2. Determine direction from red/green vertical order only.',
    '3. Identify the exact horizontal split line between red and green. That is entry.',
    '4. Identify the exact outer boundary of the red zone. That is stop_loss.',
    '5. Project those exact two horizontal boundaries to the right price axis.',
    '6. Use only labels that are horizontally aligned with those exact projected boundaries.',
    '7. If a label is merely nearby but not aligned with the exact boundary, ignore it.',
    '',
    'Extraction rules:',
    '1. direction is derived only from the zone order of the active position tool.',
    '2. entry is derived only from the split line of the active position tool.',
    '3. stop_loss is derived only from the red-zone outer boundary of the active position tool.',
    '4. Extract coin from the chart header if clearly visible; return base ticker only, e.g. BTC, ETH, SOL, ZEC.',
    includeTargetPrice
      ? '5. target_price must come from the OUTER EDGE OF THE GREEN ZONE of the same active position tool (never from red zone, current-price line, or unrelated lines).'
      : '5. Skip target_price extraction for live trade prefill.',
    '6. Extract trade_date only when explicitly visible and format as YYYY-MM-DD; otherwise null.',
    '7. Extract trade_time only when explicitly visible and format as HH:mm:ss in UTC; otherwise null.',
    '',
    'Ignore completely:',
    '- dotted line',
    '- black current-price label',
    '- live price projection',
    '- text inside the position tool',
    '- drag handles',
    '- candles except for locating the active tool near the latest candles',
    '- unrelated chart labels',
    '- fib labels',
    '- moving averages',
    '- support/resistance lines',
    '- annotations',
    '- labels from older drawings or zones elsewhere on the chart',
    '',
    'Hard constraints:',
    '- entry must be the split line between the red and green zones',
    '- entry must NEVER be the black current-price label',
    '- if a gray split-line label exists, entry must equal that gray label',
    '- stop_loss must come only from the red-zone outer boundary',
    '- stop_loss must NEVER come from the green zone',
    '- for a short setup, stop_loss must be above entry',
    '- for a long setup, stop_loss must be below entry',
    '- if exact horizontal alignment is unclear, return null',
    '- if coin/date/time are not explicitly visible, return null for those fields',
    includeTargetPrice
      ? '- if target_price cannot be aligned with the green-zone outer boundary, return null'
      : '- target_price should be omitted from live extraction output',
    '',
    'Sanity checks before answering:',
    '- If direction = short, red must be above green, entry must be the split line, and stop_loss must be above entry on the red-zone top boundary.',
    '- If direction = long, green must be above red, entry must be the split line, and stop_loss must be below entry on the red-zone bottom boundary.',
    includeTargetPrice
      ? '- target_price must come from the green-zone outer boundary of the same active position tool.'
      : '- do not infer target_price for live extraction.',
    '- If a candidate stop_loss comes from the green zone or from an unrelated chart line, reject it and return null instead of guessing.',
    '',
    'Worked example:',
    '- If black current-price label = 199.17 and gray split-line label = 196.34, then entry = 196.34.',
    '- If red zone is above green zone, direction = short.',
    '- If the top edge of the red zone aligns with 203.75, then stop_loss = 203.75.',
    '- If the green-zone outer boundary aligns with 181.52, that is NOT stop_loss and must be ignored.',
    '- In that case, 199.17 must be ignored for entry and 181.52 must be ignored for stop_loss.',
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

  return {
    fields: {
      coin,
      direction,
      avg_entry: avgEntry,
      stop_loss: stopLoss,
      avg_exit: avgExit,
      risk,
      r_multiple: null,
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
