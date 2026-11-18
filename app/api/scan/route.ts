import { NextRequest, NextResponse } from 'next/server';
import { ApiError, GoogleGenAI } from '@google/genai';
import { createHash } from 'node:crypto';
import { checkScanLimit } from '@/lib/scan-limiter';
import { isAdminRequest } from '@/lib/adminAuth';
import { recordScanEvent } from '@/lib/audit';

export const runtime = 'nodejs';

const UPSTREAM_TIMEOUT_MS = 30_000;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

const rateCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateCounts.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (rateCounts.size > 10_000) {
      for (const [key, value] of rateCounts) {
        if (now >= value.resetAt) rateCounts.delete(key);
      }
    }
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

type ScanPayload = {
  items: { name: string; price: number }[];
  serviceChargePercent: number;
  taxPercent: number;
  roundingAdjustment: number;
  restaurantName?: string;
};

const ROUNDING_KEYWORD_RE = /rounding|round\s*off|pelarasan|5\s*sen/i;
const ROUNDING_VALUE_RE = /([+-]?\s*(?:RM\s*)?\d+(?:\.\d{1,2})?)/i;
const ROUNDING_LINE_AMOUNT_RE = /(?:rounding|round\s*off|pelarasan|5\s*sen)[^+\-\d]*([+-]?\s*(?:RM\s*)?\d+(?:\.\d{1,2})?)/i;

function signedAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value !== 'string') return null;
  const match = value.match(ROUNDING_VALUE_RE);
  if (!match) return null;
  const amount = Number(match[1].replace(/RM\s*/i, '').replace(/\s+/g, ''));
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

function extractRoundingAdjustment(obj: Record<string, unknown>): number {
  const direct = signedAmount(obj.roundingAdjustment);
  if (direct !== null) return direct;

  for (const [key, value] of Object.entries(obj)) {
    if (!ROUNDING_KEYWORD_RE.test(key)) continue;
    const amount = signedAmount(value);
    if (amount !== null) return amount;
  }

  for (const value of Object.values(obj)) {
    if (typeof value !== 'string') continue;
    const line = value
      .split(/\r?\n/)
      .find((candidate) => ROUNDING_KEYWORD_RE.test(candidate));
    if (!line) continue;
    const lineAmount = line.match(ROUNDING_LINE_AMOUNT_RE)?.[1];
    const amount = lineAmount ? signedAmount(lineAmount) : null;
    if (amount !== null) return amount;
  }
  return 0;
}

function extractJsonText(text: unknown): string | null {
  if (typeof text !== 'string' || !text.trim()) return null;
  return text.trim();
}

function parseJsonLoose(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function coerceScanResult(data: unknown): ScanPayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj = data as Record<string, unknown>;
  if (
    typeof obj.restaurantName !== 'string' ||
    !Array.isArray(obj.items) ||
    !obj.items.every((item: unknown) => {
      if (typeof item !== 'object' || item === null) return false;
      const entry = item as Record<string, unknown>;
      return typeof entry.name === 'string' && entry.name.trim().length > 0 &&
        typeof entry.price === 'number' && Number.isFinite(entry.price) && entry.price >= 0;
    }) ||
    !['serviceChargePercent', 'taxPercent', 'roundingAdjustment'].every(
      (key) => typeof obj[key] === 'number' && Number.isFinite(obj[key]),
    ) ||
    (obj.serviceChargePercent as number) < 0 || (obj.serviceChargePercent as number) > 100 ||
    (obj.taxPercent as number) < 0 || (obj.taxPercent as number) > 100
  ) return null;

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = rawItems
    .map((raw) => {
      if (typeof raw !== 'object' || raw === null) return null;
      const entry = raw as Record<string, unknown>;
      const name = String(entry.name ?? '').trim();
      const price = Number(entry.price);
      if (!name || !Number.isFinite(price) || price < 0) return null;
      return { name, price: Math.round(price * 100) / 100 };
    })
    .filter((it): it is { name: string; price: number } => it !== null);

  const percent = (value: unknown): number => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, 100);
  };

  const restaurantName = String(obj.restaurantName ?? '').trim().slice(0, 60);

  return {
    items,
    serviceChargePercent: percent(obj.serviceChargePercent),
    taxPercent: percent(obj.taxPercent),
    roundingAdjustment: extractRoundingAdjustment(obj),
    ...(restaurantName ? { restaurantName } : {}),
  };
}

function normalizeImageDataUrl(imageBase64: string): { mimeType: string; data: string } | { error: string } {
  const trimmed = imageBase64.trim();
  if (!trimmed) return { error: 'Image payload is empty.' };

  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/\s]+={0,2})$/i);
    if (match) {
      const [, mime, data] = match;
      return { mimeType: mime.toLowerCase(), data: data.replace(/\s+/g, '') };
    }
    return { error: 'Image payload has a "data:" prefix but is not a valid base64 data URL.' };
  }

  const cleaned = trimmed.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
    return { error: 'Image payload does not look like valid raw base64.' };
  }
  return { mimeType: 'image/jpeg', data: cleaned };
}

const receiptSchema = {
  type: 'object',
  properties: {
    restaurantName: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, price: { type: 'number' } },
        required: ['name', 'price'],
      },
    },
    serviceChargePercent: { type: 'number' },
    taxPercent: { type: 'number' },
    roundingAdjustment: { type: 'number' },
  },
  required: ['restaurantName', 'items', 'serviceChargePercent', 'taxPercent', 'roundingAdjustment'],
};

async function scanWithGroq(image: { mimeType: string; data: string }): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq is not configured');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      reasoning_effort: 'none',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Extract the restaurant name, line items, service charge percentage, tax or SST percentage, and receipt rounding adjustment. For each item use the total line price, accounting for quantity; do not include subtotal, tax, service charge, rounding, or grand total as items. Use a signed rounding amount, and use 0 for absent charges or rounding. Return JSON with restaurantName (string), items (array of objects with name and numeric price), serviceChargePercent, taxPercent, and roundingAdjustment (numbers). Use an empty restaurantName if unknown.' },
        { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } },
      ] }],
    }),
  });
  if (!response.ok) throw new Error('Groq request failed');
  const result: unknown = await response.json();
  if (typeof result !== 'object' || result === null || !('choices' in result) || !Array.isArray(result.choices)) throw new Error('Invalid Groq response');
  const content: unknown = result.choices[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Invalid Groq response');
  return content;
}

export async function POST(req: NextRequest) {
  const respond = async (body: object, status: number, code: string) => {
    await recordScanEvent(req, status, code);
    return NextResponse.json(body, { status });
  };
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown_ip';
    const userAgent = req.headers.get('user-agent') || 'unknown_ua';
    const serverFingerprint = createHash('md5')
      .update(`${ip}-${userAgent}`)
      .digest('hex');
    const ipHash = createHash('md5').update(ip).digest('hex');

    const developer = isAdminRequest(req);
    if (!developer && isRateLimited(ip)) {
      return respond(
        { error: 'Too many scans. Please wait a minute and try again.' },
        429, 'rate_limited',
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[scan] server misconfigured: GEMINI_API_KEY is not set.');
      return respond(
        { error: 'AI service configuration missing' },
        500, 'configuration_missing',
      );
    }

    const body = await req.json().catch(() => null);
    const imageBase64 =
      typeof body?.imageBase64 === 'string' ? body.imageBase64.trim() : '';

    if (!imageBase64) {
      return respond(
        { error: 'Request body must include an "imageBase64" string.' },
        400, 'invalid_payload',
      );
    }

    if (imageBase64.length > 8_000_000) {
      return respond(
        { error: 'The receipt image is too large. Please use a smaller photo.' },
        413, 'image_too_large',
      );
    }

    const normalized = normalizeImageDataUrl(imageBase64);
    if ('error' in normalized) {
      return respond(
        { error: 'The receipt image data is malformed. Please re-upload the photo.' },
        400, 'invalid_image',
      );
    }

    const scanLimit = developer ? { allowed: true, remaining: null } : await checkScanLimit(serverFingerprint, ipHash);
    if (!scanLimit.allowed) {
      return respond(
        {
          error: 'DAILY_LIMIT_REACHED',
          remaining: 0,
          message: 'Daily limit of 2 free AI scans reached.',
        },
        429, 'daily_limit',
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let rawText: string | null;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: [{
          role: 'user',
          parts: [
            { text: 'Extract the restaurant name, line items, service charge percentage, tax or SST percentage, and receipt rounding adjustment. For each item use the total line price, accounting for quantity; do not include subtotal, tax, service charge, rounding, or grand total as items. Inspect rounding, round off, pelarasan, or 5 sen lines. Use a signed rounding amount, and use 0 for absent charges or rounding. Use an empty restaurant name if unknown.' },
            { inlineData: { mimeType: normalized.mimeType, data: normalized.data } },
          ],
        }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: receiptSchema,
          abortSignal: controller.signal,
          httpOptions: {
            retryOptions: {
              attempts: 3,
              initialDelay: 1,
              maxDelay: 2,
              httpStatusCodes: [503],
            },
          },
        },
      });
      rawText = extractJsonText(response.text);
    } catch (error) {
      if (controller.signal.aborted) {
        console.error('[scan] Gemini request timed out.');
      } else if (error instanceof ApiError) {
        console.error(`[scan] Gemini API returned HTTP ${error.status}.`);
      } else {
        console.error('[scan] Gemini request failed before an API status was available.');
      }
      const fallbackEligible = controller.signal.aborted || (error instanceof ApiError && (error.status === 429 || error.status >= 500));
      if (fallbackEligible && process.env.GROQ_API_KEY) {
        try {
          rawText = await scanWithGroq(normalized);
        } catch {
          console.error('[scan] Groq fallback failed.');
          return respond({ error: 'The AI service failed to process the receipt. Please try again.' }, 502, 'upstream_error');
        }
      } else return respond(
        { error: controller.signal.aborted
          ? 'The AI service took too long to respond. Please try again.'
          : error instanceof ApiError && error.status === 503
            ? 'The AI service is temporarily unavailable. Please try again shortly.'
            : 'The AI service failed to process the receipt. Please try again.' },
        502, controller.signal.aborted ? 'upstream_timeout' : 'upstream_error',
      );
    } finally {
      clearTimeout(timeout);
    }

    const parsed = rawText ? parseJsonLoose(rawText) : null;
    if (rawText && parsed === null) {
      console.error('[scan] failed to parse JSON from model response.');
    }

    const result = coerceScanResult(parsed);

    if (!result) {
      return respond(
        {
          error:
            'Could not read any items from the receipt. Try a clearer, well-lit photo.',
        },
        422, 'unreadable_receipt',
      );
    }

    if (result.items.length === 0) {
      return respond(
        { error: 'No line items were detected in the receipt image.' },
        422, 'no_items',
      );
    }

    return respond({ ...result, remaining: scanLimit.remaining, developer }, 200, 'scan_success');
  } catch {
    console.error('[scan] unexpected server error.');
    return respond(
      { error: 'Unexpected server error while scanning the receipt.' },
      500, 'internal_error',
    );
  }
}
