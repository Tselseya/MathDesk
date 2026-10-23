import {
  MathDeskAIError,
  type MathDeskAIClient,
  type MathDeskMode,
  type MathDeskRequest,
  type RequestOptions,
} from '../types/ai';
import { base64Bytes } from '../lib/images';
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_ENCODED_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_PROMPT_CHARS,
  MAX_TOTAL_IMAGE_BYTES,
} from '../lib/limits';
import { currentUserId, supabase, supabaseConfigured } from './supabase';

const DEFAULT_TIMEOUT_MS = 60_000;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const MODES: MathDeskMode[] = ['solve', 'learn', 'practice', 'deskbot'];

/** Rejects oversized or malformed requests before they leave the browser. The Edge Function repeats these checks. */
export function validateRequest(request: MathDeskRequest) {
  const fail = (message: string) => { throw new MathDeskAIError(message, 'validation'); };
  if (!MODES.includes(request.mode)) fail('Unknown request type.');
  if (typeof request.message !== 'string' || request.message.length > MAX_PROMPT_CHARS) {
    fail(`Please keep your message under ${MAX_PROMPT_CHARS.toLocaleString()} characters.`);
  }
  const images = request.images ?? [];
  if (images.length > MAX_IMAGES_PER_MESSAGE) fail(`You can attach up to ${MAX_IMAGES_PER_MESSAGE} images per message.`);
  let total = 0;
  for (const image of images) {
    if (!ALLOWED_UPLOAD_TYPES.includes(image.mimeType) || !BASE64.test(image.data)) fail('One of the images is not a supported format.');
    const bytes = base64Bytes(image.data);
    total += bytes;
    if (bytes > MAX_ENCODED_IMAGE_BYTES) fail('One of the images is too large. Try a smaller photo or crop it.');
  }
  if (total > MAX_TOTAL_IMAGE_BYTES) fail('The images are too large together. Remove one or use smaller photos.');
}

function messageForStatus(status: number) {
  if (status === 401) return 'MathDesk could not start a guest session. Please try again.';
  if (status === 429) return 'MathDesk AI is at its usage limit right now. Please try again in a few minutes, or tomorrow if it persists.';
  if (status === 413) return 'That message or image is too large. Try something shorter or a smaller image.';
  if (status === 400 || status === 422) return 'That request could not be processed. Please check your message and try again.';
  return 'MathDesk AI is having trouble right now. Please try again in a moment.';
}

/** The browser invokes the protected Supabase Function with a guest or signed-in session. Provider credentials stay server-side. */
export class SupabaseMathDeskAI implements MathDeskAIClient {
  private readonly defaultTimeoutMs: number;

  constructor(defaultTimeoutMs = DEFAULT_TIMEOUT_MS) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /** Reports whether the public Supabase client is configured; authentication is checked per request. */
  get configured() {
    return supabaseConfigured && Boolean(supabase);
  }

  async request(request: MathDeskRequest, options: RequestOptions = {}): Promise<string> {
    if (!this.configured) {
      throw new MathDeskAIError('MathDesk AI is not available right now. Please try again later.', 'configuration');
    }
    validateRequest(request);
    if (!(await currentUserId())) {
      const { error } = await supabase!.auth.signInAnonymously();
      if (error) throw new MathDeskAIError('Guest AI is not enabled for this project yet. Please try again later.', 'configuration');
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      const result = await supabase!.functions.invoke<{ reply?: string; error?: string }>('mathdesk-ai', {
        body: request,
        signal: controller.signal,
      });
      if (result.error) {
        const status = Number((result.error as { context?: Response }).context?.status || 502);
        throw new MathDeskAIError(messageForStatus(status), status === 429 ? 'rate_limit' : 'http', status);
      }
      const reply = String(result.data?.reply || '').trim();
      if (!reply) throw new MathDeskAIError('MathDesk AI did not send an answer. Please try again.', 'empty');
      return reply;
    } catch (error) {
      if (error instanceof MathDeskAIError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (options.signal?.aborted) throw error;
        throw new MathDeskAIError(
          `MathDesk AI took longer than ${Math.round(timeoutMs / 1000)} seconds to answer. Please try again.`,
          'timeout',
        );
      }
      throw new MathDeskAIError('Could not reach MathDesk AI. Check your connection and try again.', 'network');
    } finally {
      window.clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  private requestMode(message: string, mode: MathDeskMode, extraData: Record<string, unknown> = {}, options?: RequestOptions) {
    return this.request({ message, mode, ...extraData }, options);
  }
  solve(message: string, extraData: Record<string, unknown> = {}, options?: RequestOptions) { return this.requestMode(message, 'solve', extraData, options); }
  learn(message: string, extraData: Record<string, unknown> = {}, options?: RequestOptions) { return this.requestMode(message, 'learn', extraData, options); }
  practice(message: string, extraData: Record<string, unknown> = {}, options?: RequestOptions) { return this.requestMode(message, 'practice', extraData, options); }
  askDesky(message: string, extraData: Record<string, unknown> = {}, options?: RequestOptions) { return this.requestMode(message, 'deskbot', extraData, options); }
}

export const mathdeskAI = new SupabaseMathDeskAI();
