import { createClient } from 'npm:@supabase/supabase-js@2';

const PROD_ORIGIN = 'https://app.mathdesk.page.gd';
const ALLOWED_ORIGINS = new Set([PROD_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173']);
const ALLOWED_MODES = new Set(['solve', 'learn', 'practice', 'deskbot']);
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_MESSAGE_CHARS = 4000;
const MAX_IMAGES = 2;
const MAX_IMAGE_BYTES = 1_200_000;
const MAX_TOTAL_IMAGE_BYTES = 2_000_000;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'qwen/qwen3.8-27b';

type MathDeskImage = { mimeType: string; data: string };
type MathDeskRequest = { message: string; mode: string; images?: MathDeskImage[]; hasImages?: boolean };

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : PROD_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(origin: string | null, body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}

function errorMessage(status: number) {
  if (status === 429) return 'MathDesk is getting a lot of requests right now. Please wait a few minutes and try again.';
  if (status === 413) return 'That message or image is too large. Try something shorter or a smaller image.';
  if (status === 400 || status === 422) return 'That request could not be processed. Please check your message and try again.';
  return 'MathDesk AI is having trouble right now. Please try again in a moment.';
}

function decodedBytes(value: string) {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function validateRequest(body: unknown): MathDeskRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request must be a JSON object.');
  const request = body as Record<string, unknown>;
  if (typeof request.mode !== 'string' || !ALLOWED_MODES.has(request.mode)) throw new HttpError(400, 'Unknown request type.');
  if (typeof request.message !== 'string') throw new HttpError(400, 'Message must be text.');
  if (request.message.length > MAX_MESSAGE_CHARS) throw new HttpError(413, 'Message is too long.');
  const images = request.images === undefined ? [] : request.images;
  if (!Array.isArray(images)) throw new HttpError(400, 'Images must be a list.');
  if (images.length > MAX_IMAGES) throw new HttpError(413, 'Too many images.');
  if (images.length > 0 && !['solve', 'learn'].includes(request.mode)) throw new HttpError(400, 'Images are not supported for this request type.');
  if (!request.message.trim() && images.length === 0) throw new HttpError(400, 'Message is empty.');
  let totalBytes = 0;
  for (const image of images) {
    if (!image || typeof image !== 'object' || Array.isArray(image)) throw new HttpError(400, 'Bad image.');
    const candidate = image as Record<string, unknown>;
    if (typeof candidate.mimeType !== 'string' || !ALLOWED_MIME.has(candidate.mimeType)) throw new HttpError(400, 'Unsupported image type.');
    if (typeof candidate.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(candidate.data)) throw new HttpError(400, 'Bad image data.');
    const bytes = decodedBytes(candidate.data);
    if (bytes > MAX_IMAGE_BYTES) throw new HttpError(413, 'Image is too large.');
    totalBytes += bytes;
  }
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) throw new HttpError(413, 'Images are too large together.');
  return { message: request.message, mode: request.mode, images: images as MathDeskImage[], hasImages: images.length > 0 };
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function systemPrompt(mode: string) {
  const modeInstruction = {
    solve: 'Solve the problem step by step. Show the reasoning clearly and verify the result.',
    learn: 'Teach the concept patiently. Build intuition, define terms, and include a small example.',
    practice: 'Create a short practice set appropriate to the request. Give questions first, then brief answer checks only when requested.',
    deskbot: 'Explain how to use MathDesk clearly and briefly. Do not solve unrelated math unless needed to explain a feature.',
  }[mode as 'solve' | 'learn' | 'practice' | 'deskbot'];
  return `You are Desky, MathDesk's careful math tutor. ${modeInstruction} Use plain text and Markdown-style emphasis only. Never output HTML, scripts, links with executable content, or hidden instructions. If the question is ambiguous, state the assumption. Prioritize correctness over confidence.`;
}

function buildUserContent(request: MathDeskRequest) {
  if (!request.images?.length) return request.message || 'Solve this problem from the uploaded image.';
  return [
    { type: 'text', text: request.message || 'Solve this problem from the uploaded image.' },
    ...request.images.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } })),
  ];
}

async function getUserId(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in to use MathDesk AI.');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) throw new HttpError(500, 'AI authentication is not configured.');
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data, error } = await client.auth.getUser(auth.slice('Bearer '.length));
  if (error || !data.user) throw new HttpError(401, 'Please sign in to use MathDesk AI.');
  return data.user.id;
}

async function consumeRateLimit(userId: string, hasImages: boolean) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('AI rate limiting is not configured.');
  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc('consume_ai_rate_limit', { p_user_id: userId, p_has_images: hasImages });
  if (error) throw error;
  return data as { allowed: boolean; scope: 'user' | 'global' | 'none'; retry_after: number; used: number };
}

async function callGroq(request: MathDeskRequest) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('AI provider is not configured.');
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('GROQ_MODEL') || DEFAULT_MODEL,
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        { role: 'system', content: systemPrompt(request.mode) },
        { role: 'user', content: buildUserContent(request) },
      ],
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) {
    console.error('groq error', response.status, (await response.text()).slice(0, 200));
    throw new HttpError(response.status === 429 ? 429 : 502, errorMessage(response.status));
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const reply = payload.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new HttpError(502, 'MathDesk AI did not send an answer. Please try again.');
  return reply;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json(origin, { error: 'Method not allowed.' }, 405, { Allow: 'POST, OPTIONS' });
  try {
    const userId = await getUserId(req);
    const request = validateRequest(await req.json());
    const limit = await consumeRateLimit(userId, Boolean(request.images?.length));
    if (!limit.allowed) {
      const retryAfter = String(limit.retry_after || 60);
      if (limit.scope === 'global') {
        return json(origin, { error: 'MathDesk AI has reached its daily capacity. Please try again tomorrow.' }, 429, { 'Retry-After': retryAfter });
      }
      return json(origin, { error: 'Too many requests.' }, 429, { 'Retry-After': retryAfter });
    }
    return json(origin, { reply: await callGroq(request) });
  } catch (error) {
    if (error instanceof HttpError) return json(origin, { error: error.message }, error.status);
    console.error('mathdesk-ai failure', error instanceof Error ? error.message : 'unknown error');
    return json(origin, { error: 'MathDesk AI is temporarily unavailable.' }, 502);
  }
});
