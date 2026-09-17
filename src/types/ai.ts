export type MathDeskMode = 'solve' | 'learn' | 'practice' | 'deskbot';

export interface MathDeskImage {
  mimeType: string;
  data: string;
}

export interface MathDeskRequest {
  message: string;
  mode: MathDeskMode;
  hasImages?: boolean;
  images?: MathDeskImage[];
  [key: string]: unknown;
}

export interface MathDeskAIClient {
  request(request: MathDeskRequest, options?: RequestOptions): Promise<string>;
  solve(message: string, extraData?: Record<string, unknown>): Promise<string>;
  learn(message: string, extraData?: Record<string, unknown>): Promise<string>;
  practice(message: string, extraData?: Record<string, unknown>): Promise<string>;
  askDesky(message: string, extraData?: Record<string, unknown>): Promise<string>;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class MathDeskAIError extends Error {
  readonly status?: number;
  readonly code: 'configuration' | 'timeout' | 'http' | 'empty' | 'network';

  constructor(
    message: string,
    code: MathDeskAIError['code'],
    status?: number,
  ) {
    super(message);
    this.name = 'MathDeskAIError';
    this.code = code;
    this.status = status;
  }
}
