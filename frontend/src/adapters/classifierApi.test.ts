import { describe, expect, it, vi } from 'vitest';
import { ClassifierApi, ClassifierApiError, type Fetcher } from './classifierApi';

describe('ClassifierApi', () => {
  it('posts a JPEG as multipart data and maps a valid response', async () => {
    const fetcher = vi.fn<Fetcher>(async () =>
      new Response(
        JSON.stringify({ hand: 'scissors', confidence: 0.88, latency_ms: 12.5 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const classifier = new ClassifierApi(fetcher);

    await expect(
      classifier.classify(new Blob(['jpeg'], { type: 'image/jpeg' })),
    ).resolves.toEqual({ hand: 'scissors', confidence: 0.88, latencyMs: 12.5 });

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('/api/classify');
    expect(request?.method).toBe('POST');
    expect(request?.body).toBeInstanceOf(FormData);
    expect((request?.body as FormData).get('image')).toBeInstanceOf(Blob);
    expect(request?.headers).toBeUndefined();
  });

  it('surfaces backend error detail and status', async () => {
    const fetcher = vi.fn<Fetcher>(async () =>
      new Response(JSON.stringify({ detail: 'invalid image' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const promise = new ClassifierApi(fetcher).classify(new Blob(['bad']));

    await expect(promise).rejects.toEqual(
      expect.objectContaining<Partial<ClassifierApiError>>({
        message: 'invalid image',
        status: 400,
      }),
    );
  });

  it('rejects malformed successful responses', async () => {
    const fetcher = vi.fn<Fetcher>(async () =>
      new Response(JSON.stringify({ hand: 'lizard', confidence: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      new ClassifierApi(fetcher).classify(new Blob(['image'])),
    ).rejects.toThrow('レスポンス形式が不正');
  });
});
