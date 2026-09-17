import {
  MathDeskAIError,
  type MathDeskAIClient,
  type MathDeskMode,
  type MathDeskRequest,
  type RequestOptions,
} from '../types/ai';

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * The adapter deliberately owns transport details so UI components never need
 * to know whether MathDesk is using local n8n, a Cloudflare Tunnel, or a
 * future hosted API gateway.
 */
export class N8nMathDeskAI implements MathDeskAIClient {
  private readonly endpoint: string;
  private readonly defaultTimeoutMs: number;

  constructor(
    endpoint = import.meta.env.VITE_MATHDESK_API_URL || import.meta.env.VITE_N8N_WEBHOOK_URL || '',
    defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.endpoint = endpoint;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  async request(
    request: MathDeskRequest,
    options: RequestOptions = {},
  ): Promise<string> {
    if (!this.endpoint) {
      throw new MathDeskAIError(
        'MathDesk AI is not configured yet. Set VITE_N8N_WEBHOOK_URL in your local environment.',
        'configuration',
      );
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new MathDeskAIError(
          `MathDesk AI returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}. Check that the workflow is active.`,
          'http',
          response.status,
        );
      }

      const reply = (await response.text()).trim();
      if (!reply) {
        throw new MathDeskAIError(
          'MathDesk AI returned an empty response. The workflow may have stopped before its Respond node.',
          'empty',
        );
      }

      return reply;
    } catch (error) {
      if (error instanceof MathDeskAIError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new MathDeskAIError(
          `MathDesk AI timed out after ${Math.round(timeoutMs / 1000)} seconds. Check your n8n instance and try again.`,
          'timeout',
        );
      }
      throw new MathDeskAIError(
        error instanceof Error ? error.message : 'Could not reach MathDesk AI.',
        'network',
      );
    } finally {
      window.clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  private requestMode(
    message: string,
    mode: MathDeskMode,
    extraData: Record<string, unknown> = {},
  ) {
    return this.request({ message, mode, ...extraData });
  }

  solve(message: string, extraData: Record<string, unknown> = {}) {
    return this.requestMode(message, 'solve', extraData);
  }

  learn(message: string, extraData: Record<string, unknown> = {}) {
    return this.requestMode(message, 'learn', extraData);
  }

  practice(message: string, extraData: Record<string, unknown> = {}) {
    return this.requestMode(message, 'practice', extraData);
  }

  askDesky(message: string, extraData: Record<string, unknown> = {}) {
    return this.requestMode(message, 'deskbot', extraData);
  }
}

export const mathdeskAI = new N8nMathDeskAI();
