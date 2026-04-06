import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { userService, __testUtils } from '../user-service';
import { setCache, getCache, clearCache } from '../cache';
import 'fake-indexeddb/auto';

const TEST_DB_PATH = './data/test-service.db';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('User Service', () => {
  beforeAll(() => {
    process.env.DB_PATH = TEST_DB_PATH;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
  });

  afterEach(async () => {
    await clearCache();
  });

  describe('getUsers', () => {
    it('should fetch users successfully', async () => {
      const mockUsers = {
        users: [
          {
            id: '1',
            firstName: 'John',
            lastName: 'Doe',
            fullName: 'John Doe',
            email: 'john@example.com',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
            isActive: true,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      });

      const result = await userService.getUsers();
      expect(result).toEqual(mockUsers);
      expect(mockFetch).toHaveBeenCalledWith('/api/users');
    });

    it('should return cached users if available', async () => {
      const cachedUsers = {
        users: [
          {
            id: '1',
            firstName: 'Cached',
            lastName: 'User',
            fullName: 'Cached User',
            email: 'cached@example.com',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
            isActive: true,
          },
        ],
      };

      await setCache('users:list', cachedUsers);

      const result = await userService.getUsers();
      expect(result).toEqual(cachedUsers);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should retry on 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ users: [] }),
        });

      const result = await userService.getUsers();
      expect(result).toEqual({ users: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw on 4xx errors without retry', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' }),
      });

      await expect(userService.getUsers()).rejects.toThrow('Bad request');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUser', () => {
    it('should fetch single user successfully', async () => {
      const mockUser = {
        user: {
          id: '1',
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          email: 'john@example.com',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          isActive: true,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const result = await userService.getUser('1');
      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith('/api/users/1');
    });

    it('should return cached user if available', async () => {
      const cachedUser = {
        user: {
          id: '1',
          firstName: 'Cached',
          lastName: 'User',
          fullName: 'Cached User',
          email: 'cached@example.com',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          isActive: true,
        },
      };

      await setCache('users:1', cachedUser);

      const result = await userService.getUser('1');
      expect(result).toEqual(cachedUser);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw when user not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'User not found' }),
      });

      await expect(userService.getUser('999')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const mockUser = {
        user: {
          id: '1',
          firstName: 'New',
          lastName: 'User',
          fullName: 'New User',
          email: 'new@example.com',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          isActive: true,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const result = await userService.createUser({
        firstName: 'New',
        lastName: 'User',
        email: 'new@example.com',
        password: 'password123',
      });

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'New',
          lastName: 'User',
          email: 'new@example.com',
          password: 'password123',
        }),
      });
    });

    it('should throw on duplicate email', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Email already exists' }),
      });

      await expect(
        userService.createUser({
          firstName: 'New',
          lastName: 'User',
          email: 'existing@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Email already exists');
    });

    it('should clear users cache after creating user', async () => {
      const mockUser = {
        user: {
          id: '1',
          firstName: 'New',
          lastName: 'User',
          fullName: 'New User',
          email: 'new@example.com',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          isActive: true,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      await setCache('users:list', { users: [] });

      await userService.createUser({
        firstName: 'New',
        lastName: 'User',
        email: 'new@example.com',
        password: 'password123',
      });

      const cached = await getCache('users:list');
      expect(cached).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const mockUser = {
        user: {
          id: '1',
          firstName: 'Updated',
          lastName: 'User',
          fullName: 'Updated User',
          email: 'updated@example.com',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
          isActive: true,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const result = await userService.updateUser('1', {
        firstName: 'Updated',
      });

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith('/api/users/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'Updated' }),
      });
    });

    it('should clear user cache after updating', async () => {
      const mockUser = {
        user: {
          id: '1',
          firstName: 'Updated',
          lastName: 'User',
          fullName: 'Updated User',
          email: 'updated@example.com',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
          isActive: true,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      await setCache('users:1', { user: { id: '1' } });
      await setCache('users:list', { users: [] });

      await userService.updateUser('1', { firstName: 'Updated' });

      const userCached = await getCache('users:1');
      const listCached = await getCache('users:list');
      expect(userCached).toBeNull();
      expect(listCached).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await userService.deleteUser('1');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith('/api/users/1', {
        method: 'DELETE',
      });
    });

    it('should throw when deleting non-existent user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'User not found' }),
      });

      await expect(userService.deleteUser('999')).rejects.toThrow(
        'User not found',
      );
    });

    it('should clear user cache after deleting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await setCache('users:1', { user: { id: '1' } });
      await setCache('users:list', { users: [] });

      await userService.deleteUser('1');

      const userCached = await getCache('users:1');
      const listCached = await getCache('users:list');
      expect(userCached).toBeNull();
      expect(listCached).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear users list cache', async () => {
      await setCache('users:list', { users: [] });

      await userService.clearCache();

      const cached = await getCache('users:list');
      expect(cached).toBeNull();
    });
  });

  describe('fetchWithRetry', () => {
    it('should succeed after max retries', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ users: [] }),
        });

      const result = await userService.getUsers();
      expect(result).toEqual({ users: [] });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting all retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });

      await expect(userService.getUsers()).rejects.toThrow('Server error');
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should execute without cache when useCache is false', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ users: ['no-cache'] });

      const result = await __testUtils.fetchWithRetry(
        fetchFn,
        'users:no-cache',
        false,
      );

      expect(result).toEqual({ users: ['no-cache'] });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should use cache without calling fetch on second request', async () => {
      const mockUsers = { users: [] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsers,
      });

      // First call - hits API
      await userService.getUsers();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await userService.getUsers();
      expect(result).toEqual(mockUsers);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional calls
    });
  });

  describe('handleResponse', () => {
    it('should handle non-JSON error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      // 4xx errors are not retried, so we get the actual error
      await expect(userService.getUsers()).rejects.toThrow('Unknown error');
    });

    it('should handle HTTP error without message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({}),
      });

      // 4xx errors are not retried, so we get the actual error message
      await expect(userService.getUsers()).rejects.toThrow('HTTP 400');
    });
  });
});
