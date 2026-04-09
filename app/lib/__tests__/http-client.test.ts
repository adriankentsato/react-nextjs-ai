import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiResponse,
  HttpClient,
  HttpError,
  __testUtils,
  getApiErrorMessages,
} from '../http-client';

function createJsonResponse(
  data: ApiResponse<unknown>,
  options?: { ok?: boolean; status?: number },
): Response {
  return {
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    json: async () => data,
  } as Response;
}

describe('HttpClient', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('caches GET responses and reuses cached value', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createJsonResponse({
        data: [{ id: '1', name: 'First' }],
        pagination: null,
        processId: 'proc-1',
        message: 'ok',
        errors: null,
      }),
    );
    const client = new HttpClient({ fetchFn });

    const first =
      await client.get<Array<{ id: string; name: string }>>('/api/users');
    const second =
      await client.get<Array<{ id: string; name: string }>>('/api/users');

    expect(first).toEqual(second);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('uses default TTL of 5 minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T10:00:00.000Z'));

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          data: { value: 1 },
          pagination: null,
          processId: 'proc-1',
          message: 'ok',
          errors: null,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          data: { value: 2 },
          pagination: null,
          processId: 'proc-2',
          message: 'ok',
          errors: null,
        }),
      );

    const client = new HttpClient({ fetchFn });

    const first = await client.get<{ value: number }>('/api/ttl');
    expect(first.data.value).toBe(1);

    vi.advanceTimersByTime(__testUtils.DEFAULT_TTL_MS - 1);
    const second = await client.get<{ value: number }>('/api/ttl');
    expect(second.data.value).toBe(1);

    vi.advanceTimersByTime(2);
    const third = await client.get<{ value: number }>('/api/ttl');
    expect(third.data.value).toBe(2);

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns same in-flight promise for duplicate requests', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>(resolve => {
          resolveFetch = resolve;
        }),
    );

    const client = new HttpClient({ fetchFn });

    const promiseA = client.get<{ ok: boolean }>('/api/dupe');
    const promiseB = client.get<{ ok: boolean }>('/api/dupe');

    expect(promiseA).toBe(promiseB);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    resolveFetch?.(
      createJsonResponse({
        data: { ok: true },
        pagination: null,
        processId: 'proc-1',
        message: 'ok',
        errors: null,
      }),
    );

    const [resultA, resultB] = await Promise.all([promiseA, promiseB]);
    expect(resultA.data).toEqual({ ok: true });
    expect(resultB.data).toEqual({ ok: true });
  });

  it('does not cache failed responses', async () => {
    // First request: fails after all retries (3 attempts), second request: succeeds
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            data: null,
            pagination: null,
            processId: 'proc-err-1',
            message: 'Server error',
            errors: [{ type: 'server', message: 'Server error' }],
          },
          { ok: false, status: 500 },
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            data: null,
            pagination: null,
            processId: 'proc-err-2',
            message: 'Server error',
            errors: [{ type: 'server', message: 'Server error' }],
          },
          { ok: false, status: 500 },
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            data: null,
            pagination: null,
            processId: 'proc-err-3',
            message: 'Server error',
            errors: [{ type: 'server', message: 'Server error' }],
          },
          { ok: false, status: 500 },
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          data: { value: 2 },
          pagination: null,
          processId: 'proc-2',
          message: 'ok',
          errors: null,
        }),
      );

    const client = new HttpClient({ fetchFn });

    await expect(client.get('/api/errors')).rejects.toBeInstanceOf(HttpError);

    const second = await client.get<{ value: number }>('/api/errors');
    expect(second.data.value).toBe(2);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('retries twice before failing for retryable errors', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          data: null,
          pagination: null,
          processId: 'proc-err',
          message: 'Server error',
          errors: [{ type: 'server', message: 'Server error' }],
        },
        { ok: false, status: 500 },
      ),
    );
    const client = new HttpClient({ fetchFn });

    await expect(client.get('/api/retry')).rejects.toBeInstanceOf(HttpError);
    expect(fetchFn).toHaveBeenCalledTimes(__testUtils.MAX_RETRIES + 1);
  });

  it('retries thrown request errors and succeeds within 3 total attempts', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockRejectedValueOnce(new TypeError('network still down'))
      .mockResolvedValueOnce(
        createJsonResponse({
          data: { ok: true },
          pagination: null,
          processId: 'proc-3',
          message: 'ok',
          errors: null,
        }),
      );
    const client = new HttpClient({ fetchFn });

    const result = await client.get<{ ok: boolean }>('/api/network-retry');
    expect(result.data.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('does not retry for 404 and 401', async () => {
    const fetchFn404 = vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          data: null,
          pagination: null,
          processId: 'proc-404',
          message: 'Not found',
          errors: [{ type: 'not_found', message: 'Not found' }],
        },
        { ok: false, status: 404 },
      ),
    );
    const client404 = new HttpClient({ fetchFn: fetchFn404 });
    await expect(client404.get('/api/not-found')).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(fetchFn404).toHaveBeenCalledTimes(1);

    const fetchFn401 = vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          data: null,
          pagination: null,
          processId: 'proc-401',
          message: 'Unauthorized',
          errors: [{ type: 'unauthorized', message: 'Unauthorized' }],
        },
        { ok: false, status: 401 },
      ),
    );
    const client401 = new HttpClient({ fetchFn: fetchFn401 });
    await expect(client401.get('/api/unauthorized')).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(fetchFn401).toHaveBeenCalledTimes(1);
  });

  it('fetches all pages and combines data', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          data: [{ id: 1 }, { id: 2 }],
          pagination: { page: 1, total: 2 },
          processId: 'proc-1',
          message: 'ok',
          errors: null,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          data: [{ id: 3 }],
          pagination: { page: 2, total: 2 },
          processId: 'proc-2',
          message: 'ok',
          errors: null,
        }),
      );
    const client = new HttpClient({ fetchFn });

    const result = await client.getAllPages<{ id: number }>('/api/users');

    expect(result.data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(result.pagination).toEqual({ page: 2, total: 2 });
    expect(fetchFn).toHaveBeenNthCalledWith(1, '/api/users?page=1', {
      method: 'GET',
      useCache: false,
      dedupe: false,
    });
    expect(fetchFn).toHaveBeenNthCalledWith(2, '/api/users?page=2', {
      method: 'GET',
      useCache: false,
      dedupe: false,
    });
  });

  it('does not cache partial pagination result if a later page fails', async () => {
    // First getAllPages: page 1 succeeds, page 2 fails after 3 retry attempts
    // Second getAllPages: page 1 succeeds, page 2 succeeds
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          data: [{ id: 1 }, { id: 2 }],
          pagination: { page: 1, total: 2 },
          processId: 'proc-1',
          message: 'ok',
          errors: null,
        }),
      )
      // Page 2: fails 3 times (initial + 2 retries)
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            data: null,
            pagination: null,
            processId: 'proc-err-1',
            message: 'Server error',
            errors: [{ type: 'server', message: 'Server error' }],
          },
          { ok: false, status: 500 },
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            data: null,
            pagination: null,
            processId: 'proc-err-2',
            message: 'Server error',
            errors: [{ type: 'server', message: 'Server error' }],
          },
          { ok: false, status: 500 },
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            data: null,
            pagination: null,
            processId: 'proc-err-3',
            message: 'Server error',
            errors: [{ type: 'server', message: 'Server error' }],
          },
          { ok: false, status: 500 },
        ),
      )
      // Second getAllPages calls: page 1 and page 2 both succeed
      .mockResolvedValueOnce(
        createJsonResponse({
          data: [{ id: 1 }, { id: 2 }],
          pagination: { page: 1, total: 2 },
          processId: 'proc-4',
          message: 'ok',
          errors: null,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          data: [{ id: 3 }],
          pagination: { page: 2, total: 2 },
          processId: 'proc-5',
          message: 'ok',
          errors: null,
        }),
      );
    const client = new HttpClient({ fetchFn });

    await expect(client.getAllPages('/api/users')).rejects.toBeInstanceOf(
      HttpError,
    );

    await client.getAllPages('/api/users');

    expect(fetchFn).toHaveBeenCalledWith('/api/users?page=1', {
      method: 'GET',
      useCache: false,
      dedupe: false,
    });
    // 6th call is page 2 of second getAllPages (first getAllPages has: page1, page2 x3 retries; second has: page1, page2)
    expect(fetchFn).toHaveBeenNthCalledWith(6, '/api/users?page=2', {
      method: 'GET',
      useCache: false,
      dedupe: false,
    });
    // 6 total: first getAllPages (page1 + page2x3 retries) + second getAllPages (page1 + page2)
    expect(fetchFn).toHaveBeenCalledTimes(6);
  });

  it('returns error messages from API error payload', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          data: null,
          pagination: null,
          processId: 'proc-err',
          message: 'Validation failed',
          errors: [
            { type: 'validation', message: 'Email is required' },
            { type: 'validation', message: 'Name is required' },
          ],
        },
        { ok: false, status: 400 },
      ),
    );
    const client = new HttpClient({ fetchFn });

    let thrown: unknown;
    try {
      await client.get('/api/error-messages');
    } catch (error) {
      thrown = error;
    }

    expect(getApiErrorMessages(thrown)).toEqual([
      'Email is required',
      'Name is required',
    ]);
  });
});
