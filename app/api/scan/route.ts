import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DEFAULT_ENDPOINT = 'https://opencode.ai/zen/go/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-v4-flash-vision-exp';

type ScanPayload = {
  items: { name: string; price: number }[];
  serviceChargePercent: number;
  taxPercent: number;
};

function maskKey(key: string): string {
  if (!key) return '(empty)';
  return `${key.slice(0, 4)}${'*'.repeat(Math.max(0, key.length - 4))}`;
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

  return {
    items,
    serviceChargePercent: percent(obj.serviceChargePercent),
    taxPercent: percent(obj.taxPercent),
  };
}

function normalizeImageDataUrl(imageBase64: string): { dataUrl: string } | { error: string } {
  const trimmed = imageBase64.trim();
  if (!trimmed) return { error: 'Image payload is empty.' };

  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (match) {
      const [, mime, data] = match;
      return { dataUrl: `data:${mime};base64,${data.replace(/\s+/g, '')}` };
    }
    return { error: 'Image payload has a "data:" prefix but is not a valid base64 data URL.' };
  }

  const cleaned = trimmed.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
    return { error: 'Image payload does not look like valid raw base64.' };
  }
  return { dataUrl: `data:image/jpeg;base64,${cleaned}` };
}

function buildRequestBody(model: string, imageDataUrl: string) {
  return {
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract line items, prices, service charge %, and tax % from this receipt. Return ONLY valid JSON: {"items":[{"name":"string","price":number}],"serviceChargePercent":number,"taxPercent":number}',
          },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENCODE_API_KEY;
    if (!apiKey) {
      console.error('[scan] OPENCODE_API_KEY is MISSING from the environment.');
      return NextResponse.json(
        { error: 'Server configuration error: OPENCODE_API_KEY is not set.' },
        { status: 500 },
      );
    }
    console.log(`[scan] OPENCODE_API_KEY is defined: ${maskKey(apiKey)}`);

    const body = await req.json().catch(() => null);
    const imageBase64 =
      typeof body?.imageBase64 === 'string' ? body.imageBase64.trim() : '';

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Request body must include an "imageBase64" string.' },
        { status: 400 },
      );
    }

    if (imageBase64.length > 8_000_000) {
      return NextResponse.json(
        { error: 'The receipt image is too large. Please use a smaller photo.' },
        { status: 413 },
      );
    }

    const normalized = normalizeImageDataUrl(imageBase64);
    if ('error' in normalized) {
      console.error(`[scan] image payload rejected: ${normalized.error}`);
      return NextResponse.json(
        { error: 'The receipt image data is malformed. Please re-upload the photo.' },
        { status: 400 },
      );
    }
    const imageDataUrl = normalized.dataUrl;
    console.log(
      `[scan] image payload accepted (length: ${imageBase64.length}, ` +
        `normalized preview: ${imageDataUrl.slice(0, 40)}...).`,
    );

    const endpoint = process.env.OPENCODE_ENDPOINT ?? DEFAULT_ENDPOINT;
    const model = process.env.OPENCODE_MODEL || DEFAULT_MODEL;

    console.log(`[scan] calling upstream ${endpoint} (model: ${model}).`);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'x-opencode-session': crypto.randomUUID(),
          'User-Agent': 'kira-kira-splitthebill/1.0',
        },
        body: JSON.stringify(buildRequestBody(model, imageDataUrl)),
      });
    } catch (fetchError) {
      console.error(`[scan] upstream fetch to ${endpoint} threw an error:`, fetchError);
      return NextResponse.json(
        { error: 'Could not reach the AI service. Please try again.' },
        { status: 502 },
      );
    }
    console.log(`[scan] upstream responded with HTTP ${response.status}.`);

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '(response body was not readable)');
      console.error(
        `[scan] upstream error HTTP ${response.status} — response body:\n${bodyText.slice(0, 2000)}`,
      );
      return NextResponse.json(
        { error: 'The AI service failed to process the receipt. Please try again.' },
        { status: 502 },
      );
    }

    const completion = await response.json().catch(() => null);
    if (!completion) {
      console.error(
        `[scan] upstream returned HTTP ${response.status} but the response was not valid JSON.`,
      );
      return NextResponse.json(
        { error: 'The AI service returned an unreadable response.' },
        { status: 502 },
      );
    }

    const content =
      completion?.choices?.[0]?.message?.content ??
      completion?.choices?.[0]?.text;

    const rawText = extractJsonText(content);
    if (!rawText) {
      console.error(
        '[scan] no text content found in completion. Raw completion:',
        JSON.stringify(completion).slice(0, 2000),
      );
    }

    const parsed = rawText ? parseJsonLoose(rawText) : null;
    if (rawText && parsed === null) {
      console.error(
        `[scan] failed to parse JSON from model response. Raw text received:\n${rawText.slice(0, 2000)}`,
      );
    }

    const result = coerceScanResult(parsed);

    if (!result) {
      return NextResponse.json(
        {
          error:
            'Could not read any items from the receipt. Try a clearer, well-lit photo.',
        },
        { status: 422 },
      );
    }

    if (result.items.length === 0) {
      return NextResponse.json(
        { error: 'No line items were detected in the receipt image.' },
        { status: 422 },
      );
    }

    console.log(`[scan] success — parsed ${result.items.length} item(s).`);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[scan] unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected server error while scanning the receipt.' },
      { status: 500 },
    );
  }
}
