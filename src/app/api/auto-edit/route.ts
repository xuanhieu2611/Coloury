import Anthropic from '@anthropic-ai/sdk';
import { HSL_BANDS, PARAM_RANGE, recipeFromAi } from '@/lib/recipe';
import type { AutoEditRequest } from '@/lib/aiEdit';

// M3 — AI Auto Edit backend (PRD 4.3 / 5.4). Proxies a real Claude vision call
// so the API key stays server-side, then validates + clamps the model's JSON
// into a safe EditRecipe before it ever reaches the client / shader pipeline.

// User-facing color/tone params the model may set, with their valid ranges —
// generated from PARAM_RANGE so the prompt can never drift from recipe.ts.
const PROMPTED_KEYS = [
  'exposure',
  'contrast',
  'highlights',
  'shadows',
  'whites',
  'blacks',
  'temperature',
  'tint',
  'vibrance',
  'saturation',
  'clarity',
  'texture',
  'sharpening',
  'vignette',
] as const;

const KEY_NOTE: Partial<Record<(typeof PROMPTED_KEYS)[number], string>> = {
  exposure: 'stops; each +1 doubles brightness',
  temperature: 'negative = cooler/bluer, positive = warmer/yellower',
  tint: 'negative = green, positive = magenta',
  vibrance: 'saturation weighted toward muted colors and away from skin',
  clarity: 'midtone local contrast',
  texture: 'fine high-frequency detail',
  vignette: 'negative = darken edges, positive = lighten edges',
};

function scalarRangeLines(): string {
  return PROMPTED_KEYS.map((k) => {
    const r = PARAM_RANGE[k];
    const note = KEY_NOTE[k] ? ` — ${KEY_NOTE[k]}` : '';
    return `  "${k}": number  // ${r.min}..${r.max}${note}`;
  }).join('\n');
}

const SYSTEM_PROMPT = `You are a professional photo editor, like a Lightroom colorist. You are given a single photograph and must judge it the way an expert would — its exposure, white balance, contrast, color, and mood — then propose concrete non-destructive adjustments that make it look its best while staying natural and believable. Avoid heavy-handed or gimmicky looks unless the user explicitly asks for one.

Respond with ONLY a single JSON object (no markdown fences, no commentary) in exactly this shape:

{
  "recipe": {
${scalarRangeLines()}
    "hsl": {
      "<band>": { "hue": number, "saturation": number, "luminance": number }  // each -100..100
    },
    "splitToning": {
      "shadowHue": number,      // 0..360
      "shadowSaturation": number, // 0..100
      "highlightHue": number,   // 0..360
      "highlightSaturation": number, // 0..100
      "balance": number         // -100..100
    }
  },
  "explanation": "One or two plain-language sentences a non-expert can understand, naming the main changes and why, e.g. 'Warmed the temperature and lifted the shadows to open up the backlit foreground, then boosted blue saturation for a punchier sky.'"
}

Rules:
- Only include fields you actually want to change. Omit any field (or whole section) you are leaving at its default of 0 — omitted fields mean "no change".
- HSL bands are: ${HSL_BANDS.join(', ')}. Only include the bands you adjust.
- Stay within every stated range. Do not invent new fields. Do not include tone curves or crop.
- The explanation must match the numbers you chose.`;

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('no JSON object found');
  }
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'Auto Edit is not configured: set ANTHROPIC_API_KEY in .env.local and restart.' },
      { status: 500 },
    );
  }

  let body: AutoEditRequest;
  try {
    body = (await request.json()) as AutoEditRequest;
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body?.image) {
    return Response.json({ error: 'Missing image data.' }, { status: 400 });
  }

  const intent = body.style
    ? `The user wants this style/mood: "${body.style}". Steer the edit toward that while keeping it natural.`
    : 'No specific style was requested — apply a balanced, natural professional edit.';
  const varyNote = body.reroll
    ? ' Give a distinctly different interpretation from a typical safe edit — a fresh creative take.'
    : '';

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      // A little reasoning improves the coherence of a 30-param grade; medium
      // effort keeps latency reasonable for a per-click interactive call.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.image },
            },
            { type: 'text', text: `Analyze this photo and return the edit recipe. ${intent}${varyNote}` },
          ],
        },
      ],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    let parsed: { recipe?: unknown; explanation?: unknown };
    try {
      const obj = extractJson(text) as Record<string, unknown>;
      // Accept either { recipe, explanation } or a bare recipe object.
      parsed = 'recipe' in obj ? obj : { recipe: obj };
    } catch {
      return Response.json(
        { error: 'The model returned an unreadable response. Try again.' },
        { status: 502 },
      );
    }

    const recipe = recipeFromAi(parsed.recipe);
    const explanation =
      typeof parsed.explanation === 'string' ? parsed.explanation.trim() : '';

    return Response.json({ recipe, explanation });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status ?? 502;
      const msg =
        status === 401
          ? 'Anthropic rejected the API key. Check ANTHROPIC_API_KEY in .env.local.'
          : status === 429
            ? 'Rate limited by Anthropic. Wait a moment and try again.'
            : `Anthropic API error (${status}).`;
      return Response.json({ error: msg }, { status });
    }
    return Response.json({ error: 'Auto Edit failed unexpectedly.' }, { status: 500 });
  }
}
