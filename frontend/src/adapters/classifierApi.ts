import { isHand } from '../game/judge';
import type { Classification, Classifier } from '../game/engine';

export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class ClassifierApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ClassifierApiError';
  }
}

export class ClassifierApi implements Classifier {
  constructor(
    private readonly fetcher: Fetcher = globalThis.fetch.bind(globalThis),
    private readonly endpoint = '/api/classify',
  ) {}

  async classify(image: Blob): Promise<Classification> {
    const form = new FormData();
    form.append('image', image, 'capture.jpg');

    const response = await this.fetcher(this.endpoint, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      throw new ClassifierApiError(
        await readErrorDetail(response),
        response.status,
      );
    }

    const payload: unknown = await response.json();
    if (!isClassificationPayload(payload)) {
      throw new ClassifierApiError('判定APIのレスポンス形式が不正です');
    }

    return {
      hand: payload.hand,
      confidence: payload.confidence,
      latencyMs: payload.latency_ms,
    };
  }
}

interface ClassificationPayload {
  readonly hand: Classification['hand'];
  readonly confidence: number;
  readonly latency_ms: number;
}

function isClassificationPayload(value: unknown): value is ClassificationPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    isHand(record.hand) &&
    typeof record.confidence === 'number' &&
    Number.isFinite(record.confidence) &&
    record.confidence >= 0 &&
    record.confidence <= 1 &&
    typeof record.latency_ms === 'number' &&
    Number.isFinite(record.latency_ms) &&
    record.latency_ms >= 0
  );
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null) {
      const detail = (payload as Record<string, unknown>).detail;
      if (typeof detail === 'string' && detail.length > 0) {
        return detail;
      }
    }
  } catch {
    // An error response is allowed to have no JSON body.
  }
  return `判定APIがエラーを返しました (${response.status})`;
}
