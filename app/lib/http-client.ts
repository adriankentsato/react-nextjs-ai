const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 2; // 2 retries = 3 total attempts

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface ApiErrorItem {
  type: string;
  message: string;
}

export interface ApiPagination {
  page: number;
  total: number;
}

export interface ApiResponse<T> {
  data: T;
  pagination: ApiPagination | null;
  processId: string;
  message: string;
  errors: ApiErrorItem[] | null;
}

export interface HttpRequestOptions extends RequestInit {
  ttlMs?: number;
  useCache?: boolean;
  dedupe?: boolean;
  cacheKey?: string;
}

export class HttpError extends Error {
  status: number;
  details: ApiResponse<unknown> | unknown;

  constructor(
    message: string,
    status: number,
    details: ApiResponse<unknown> | unknown,
  ) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = 'HttpError';
  }
}

export class HttpClient {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();
  private fetchFn: typeof fetch;
  private defaultTtlMs: number;

  constructor(options?: { fetchFn?: typeof fetch; defaultTtlMs?: number }) {
    this.fetchFn = options?.fetchFn ?? fetch;
    this.defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_TTL_MS;
  }

  request<T>(
    url: string,
    options?: HttpRequestOptions,
  ): Promise<ApiResponse<T>> {
    const method = (options?.method ?? 'GET').toUpperCase() as HttpMethod;
    const useCache = options?.useCache ?? method === 'GET';
    const dedupe = options?.dedupe ?? true;
    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;
    const key = this.buildKey(method, url, options);

    if (useCache) {
      const cached = this.getFromCache<ApiResponse<T>>(key);
      if (cached !== null) {
        return Promise.resolve(cached);
      }
    }

    if (dedupe) {
      const existing = this.inFlight.get(key);
      if (existing) {
        return existing as Promise<ApiResponse<T>>;
      }

      // Create an async IIFE that handles the request
      const requestPromise = (async (): Promise<ApiResponse<T>> => {
        try {
          const result = await this.executeRequestWithRetry<T>(
            url,
            options,
            useCache,
            ttlMs,
            key,
          );
          return result;
        } finally {
          this.inFlight.delete(key);
        }
      })();

      // Store in inFlight BEFORE the async work completes
      this.inFlight.set(key, requestPromise);

      return requestPromise;
    }

    // Non-deduped path
    return this.executeRequestWithRetry<T>(url, options, useCache, ttlMs, key);
  }

  get<T>(
    url: string,
    options?: Omit<HttpRequestOptions, 'method'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  post<T>(
    url: string,
    options?: Omit<HttpRequestOptions, 'method'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST' });
  }

  put<T>(
    url: string,
    options?: Omit<HttpRequestOptions, 'method'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT' });
  }

  delete<T>(
    url: string,
    options?: Omit<HttpRequestOptions, 'method'>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  async getAllPages<T>(
    url: string,
    options?: Omit<HttpRequestOptions, 'method'>,
  ): Promise<ApiResponse<T[]>> {
    const useCache = options?.useCache ?? true;
    const dedupe = options?.dedupe ?? true;
    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;
    const baseKey = this.buildKey('GET', url, options);
    const key = `${baseKey}:all-pages`;

    if (useCache) {
      const cached = this.getFromCache<ApiResponse<T[]>>(key);
      if (cached !== null) {
        return cached;
      }
    }

    if (dedupe) {
      const existing = this.inFlight.get(key);
      if (existing) {
        return existing as Promise<ApiResponse<T[]>>;
      }
    }

    const requestPromise = this.executePaginatedRequest<T>(
      url,
      options,
      useCache,
      ttlMs,
      key,
    ).finally(() => {
      this.inFlight.delete(key);
    });

    if (dedupe) {
      this.inFlight.set(key, requestPromise);
    }

    return requestPromise;
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearInFlight(): void {
    this.inFlight.clear();
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  private setCache<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private buildKey(
    method: string,
    url: string,
    options?: HttpRequestOptions,
  ): string {
    if (options?.cacheKey) return options.cacheKey;

    const headers = options?.headers
      ? this.normalizeHeaders(options.headers)
      : '';
    const body = typeof options?.body === 'string' ? options.body : '';
    return `${method}:${url}:${headers}:${body}`;
  }

  private normalizeHeaders(headers: HeadersInit): string {
    if (headers instanceof Headers) {
      return Array.from(headers.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value}`)
        .join('|');
    }

    if (Array.isArray(headers)) {
      return [...headers]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value}`)
        .join('|');
    }

    return Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
  }

  private async executeRequest<T>(
    url: string,
    options: HttpRequestOptions | undefined,
    useCache: boolean,
    ttlMs: number,
    key: string,
  ): Promise<ApiResponse<T>> {
    let response: Response;

    try {
      response = await this.fetchFn(url, options);
    } catch (error) {
      throw this.toHttpError(error);
    }

    const body = (await response
      .json()
      .catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok || body?.errors?.length) {
      throw this.toHttpErrorFromResponse(response.status, body);
    }

    if (!body) {
      throw new HttpError(`HTTP ${response.status}`, response.status, null);
    }

    if (useCache) {
      this.setCache(key, body, ttlMs);
    }

    return body;
  }

  private async executeRequestWithRetry<T>(
    url: string,
    options: HttpRequestOptions | undefined,
    useCache: boolean,
    ttlMs: number,
    key: string,
  ): Promise<ApiResponse<T>> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await this.executeRequest<T>(url, options, useCache, ttlMs, key);
      } catch (error) {
        lastError = error;
        if (!this.shouldRetry(error) || attempt === MAX_RETRIES) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private async executePaginatedRequest<T>(
    url: string,
    options: Omit<HttpRequestOptions, 'method'> | undefined,
    useCache: boolean,
    ttlMs: number,
    key: string,
  ): Promise<ApiResponse<T[]>> {
    const aggregated: T[] = [];
    let currentPage = 1;
    let totalPages = 1;
    let lastResponse: ApiResponse<T | T[]> | null = null;

    do {
      const pageUrl = this.withPage(url, currentPage);
      const pageResponse = await this.executeRequestWithRetry<T | T[]>(
        pageUrl,
        { ...options, method: 'GET', useCache: false, dedupe: false },
        false,
        ttlMs,
        `${key}:page:${currentPage}`,
      );
      lastResponse = pageResponse;

      if (Array.isArray(pageResponse.data)) {
        aggregated.push(...pageResponse.data);
      } else {
        aggregated.push(pageResponse.data);
      }

      if (!pageResponse.pagination) {
        break;
      }

      totalPages = pageResponse.pagination.total;
      currentPage += 1;
    } while (currentPage <= totalPages);

    const result: ApiResponse<T[]> = {
      data: aggregated,
      pagination: lastResponse?.pagination ?? null,
      processId: lastResponse?.processId ?? '',
      message: lastResponse?.message ?? 'OK',
      errors: null,
    };

    if (useCache) {
      this.setCache(key, result, ttlMs);
    }

    return result;
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof HttpError) {
      return error.status !== 401 && error.status !== 404;
    }
    return true;
  }

  private toHttpError(error: unknown): HttpError {
    const message = error instanceof Error ? error.message : 'Request failed';
    return new HttpError(message, 0, error);
  }

  private toHttpErrorFromResponse(
    status: number,
    body: ApiResponse<unknown> | null,
  ): HttpError {
    const message =
      body?.errors?.[0]?.message ?? body?.message ?? `HTTP ${status}`;
    return new HttpError(message, status, body);
  }

  private withPage(url: string, page: number): string {
    const parsed = new URL(url, 'http://codex.local');
    parsed.searchParams.set('page', String(page));

    if (/^https?:\/\//.test(url)) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
}

export const httpClient = new HttpClient();

export function getApiErrorMessages(error: unknown): string[] {
  if (error instanceof HttpError) {
    const details = error.details as ApiResponse<unknown> | null;
    if (details?.errors?.length) {
      return details.errors.map(item => item.message);
    }
    return [error.message];
  }

  if (error instanceof Error) {
    return [error.message];
  }

  return ['Unknown error'];
}

export const __testUtils = {
  DEFAULT_TTL_MS,
  MAX_RETRIES,
};
