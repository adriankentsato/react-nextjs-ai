import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setCache, getCache, deleteCache, clearCache } from '../cache';
import 'fake-indexeddb/auto';

describe('Cache Service', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearCache();
  });

  afterEach(async () => {
    await clearCache();
  });

  it('should set and get cache value', async () => {
    const key = 'test-key';
    const data = { name: 'Test', value: 123 };

    await setCache(key, data);
    const result = await getCache(key);

    expect(result).toEqual(data);
  });

  it('should return null for non-existent key', async () => {
    const result = await getCache('non-existent-key');
    expect(result).toBeNull();
  });

  it('should return null for expired cache entry', async () => {
    const key = 'expiring-key';
    const data = { test: 'data' };

    // Set cache with 1ms TTL
    await setCache(key, data, 1);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await getCache(key);
    expect(result).toBeNull();
  });

  it('should delete cache entry', async () => {
    const key = 'delete-test';
    const data = { value: 'to-delete' };

    await setCache(key, data);
    await deleteCache(key);

    const result = await getCache(key);
    expect(result).toBeNull();
  });

  it('should clear all cache entries', async () => {
    await setCache('key1', { a: 1 });
    await setCache('key2', { b: 2 });

    await clearCache();

    const result1 = await getCache('key1');
    const result2 = await getCache('key2');

    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  it('should use default TTL when not specified', async () => {
    const key = 'default-ttl';
    const data = { test: 'default' };

    await setCache(key, data);
    const result = await getCache(key);

    expect(result).toEqual(data);
  });

  it('should handle custom TTL', async () => {
    const key = 'custom-ttl';
    const data = { test: 'custom' };

    await setCache(key, data, 60000); // 1 minute
    const result = await getCache(key);

    expect(result).toEqual(data);
  });

  it('should handle different data types', async () => {
    // String
    await setCache('string', 'test string');
    expect(await getCache('string')).toBe('test string');

    // Number
    await setCache('number', 42);
    expect(await getCache('number')).toBe(42);

    // Array
    await setCache('array', [1, 2, 3]);
    expect(await getCache('array')).toEqual([1, 2, 3]);

    // Object
    await setCache('object', { nested: { deep: 'value' } });
    expect(await getCache('object')).toEqual({ nested: { deep: 'value' } });
  });

  it('should handle cache overwrite', async () => {
    const key = 'overwrite';

    await setCache(key, { version: 1 });
    await setCache(key, { version: 2 });

    const result = await getCache(key);
    expect(result).toEqual({ version: 2 });
  });

  it('should reject when opening IndexedDB fails', async () => {
    vi.resetModules();

    const openRequest: any = {
      error: new Error('open failed'),
    };

    const openSpy = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      setTimeout(() => {
        openRequest.onerror?.();
      });
      return openRequest;
    });

    const cacheModule = await import('../cache');

    await expect(
      cacheModule.setCache('open-fail', { ok: true }),
    ).rejects.toThrow('open failed');

    openSpy.mockRestore();
  });

  it('should skip creating store when upgrade sees existing store', async () => {
    vi.resetModules();

    const containsSpy = vi.fn(() => true);
    const createObjectStoreSpy = vi.fn();

    const putRequest: any = {};
    const fakeStore = {
      put: vi.fn(() => {
        setTimeout(() => {
          putRequest.onsuccess?.();
        });
        return putRequest;
      }),
    };

    const fakeDb: any = {
      objectStoreNames: {
        contains: containsSpy,
      },
      createObjectStore: createObjectStoreSpy,
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => fakeStore),
      })),
    };

    const openRequest: any = {
      error: null,
      result: fakeDb,
    };

    const openSpy = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      setTimeout(() => {
        openRequest.onupgradeneeded?.({
          target: { result: fakeDb },
        });
        openRequest.onsuccess?.();
      });
      return openRequest;
    });

    const cacheModule = await import('../cache');
    await cacheModule.setCache('existing-store', { ok: true });

    expect(containsSpy).toHaveBeenCalledWith('cache-store');
    expect(createObjectStoreSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it('should reject when IndexedDB store operations fail', async () => {
    vi.resetModules();

    const makeErrorRequest = () => {
      const request: any = { error: new Error('operation failed') };
      setTimeout(() => {
        request.onerror?.();
      });
      return request;
    };

    const fakeStore = {
      put: vi.fn(() => makeErrorRequest()),
      get: vi.fn(() => makeErrorRequest()),
      delete: vi.fn(() => makeErrorRequest()),
      clear: vi.fn(() => makeErrorRequest()),
    };

    const fakeDb: any = {
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => fakeStore),
      })),
    };

    const openRequest: any = {
      error: null,
      result: fakeDb,
    };

    const openSpy = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      setTimeout(() => {
        openRequest.onsuccess?.();
      });
      return openRequest;
    });

    const cacheModule = await import('../cache');

    await expect(
      cacheModule.setCache('put-fail', { ok: true }),
    ).rejects.toThrow('operation failed');
    await expect(cacheModule.getCache('get-fail')).rejects.toThrow(
      'operation failed',
    );
    await expect(cacheModule.deleteCache('delete-fail')).rejects.toThrow(
      'operation failed',
    );
    await expect(cacheModule.clearCache()).rejects.toThrow('operation failed');

    openSpy.mockRestore();
  });
});
