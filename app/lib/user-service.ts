import { setCache, getCache, deleteCache } from './cache';

const MAX_RETRIES = 2; // 2 retries = 3 total calls
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
}

async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  useCache: boolean = true,
): Promise<T> {
  // Try cache first for GET operations
  if (useCache) {
    const cached = await getCache<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fetchFn();

      // Cache successful responses for GET operations
      if (useCache) {
        await setCache(cacheKey, result, DEFAULT_TTL_MS);
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on 4xx errors (client errors)
      if (
        error instanceof ResponseError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

class ResponseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ResponseError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }));
    throw new ResponseError(
      errorData.error || `HTTP ${response.status}`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

// Cache key generators
const cacheKeys = {
  users: 'users:list',
  user: (id: string) => `users:${id}`,
};

export const userService = {
  // Get all users
  async getUsers(): Promise<{ users: User[] }> {
    return fetchWithRetry(
      async () => {
        const response = await fetch('/api/users');
        return handleResponse<{ users: User[] }>(response);
      },
      cacheKeys.users,
      true,
    );
  },

  // Get single user
  async getUser(id: string): Promise<{ user: User }> {
    return fetchWithRetry(
      async () => {
        const response = await fetch(`/api/users/${id}`);
        return handleResponse<{ user: User }>(response);
      },
      cacheKeys.user(id),
      true,
    );
  },

  // Create user - no caching
  async createUser(input: CreateUserInput): Promise<{ user: User }> {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const result = await handleResponse<{ user: User }>(response);

    // Invalidate users list cache
    await deleteCache(cacheKeys.users);

    return result;
  },

  // Update user - no caching, but invalidate relevant caches
  async updateUser(
    id: string,
    input: UpdateUserInput,
  ): Promise<{ user: User }> {
    const response = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const result = await handleResponse<{ user: User }>(response);

    // Invalidate caches
    await deleteCache(cacheKeys.user(id));
    await deleteCache(cacheKeys.users);

    return result;
  },

  // Delete user - no caching, but invalidate relevant caches
  async deleteUser(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
    });
    const result = await handleResponse<{ success: boolean }>(response);

    // Invalidate caches
    await deleteCache(cacheKeys.user(id));
    await deleteCache(cacheKeys.users);

    return result;
  },

  // Clear all user-related caches
  async clearCache(): Promise<void> {
    await deleteCache(cacheKeys.users);
  },
};

export const __testUtils = {
  fetchWithRetry,
};
