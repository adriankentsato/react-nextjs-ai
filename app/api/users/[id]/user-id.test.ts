import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GET, PUT, DELETE } from '@/app/api/users/[id]/route';
import { createUser, User, resetDb } from '@/app/lib/database';
import * as databaseModule from '@/app/lib/database';
import { generateTokens } from '@/app/lib/token-service';
import fs from 'fs';

const TEST_DB_PATH = './data/test-user-id-api.db';

describe('Users API - Single User Operations', () => {
  let authToken: string;
  let testUser: User;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.DB_PATH = TEST_DB_PATH;
    resetDb();

    // Clean up test db files
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-shm`);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    }

    // Create a test user and get auth token
    testUser = createUser({
      firstName: 'API',
      lastName: 'Test',
      email: 'api.user.id@example.com',
      password: 'testpassword123',
    });

    const tokens = generateTokens(testUser.id, testUser.email);
    authToken = tokens.accessToken;
  });

  afterAll(() => {
    resetDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-shm`);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    }
  });

  const createAuthRequest = (
    method: string,
    id: string,
    body?: object,
  ): import('next/server').NextRequest => {
    const headers = new Headers();
    headers.set('authorization', `Bearer ${authToken}`);

    return new Request(`http://localhost:3000/api/users/${id}`, {
      method,
      headers: {
        ...Object.fromEntries(headers.entries()),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }) as unknown as import('next/server').NextRequest;
  };

  describe('GET /api/users/[id]', () => {
    it('should return user by id with valid auth', async () => {
      const request = createAuthRequest('GET', testUser.id);
      const params = Promise.resolve({ id: testUser.id });

      const response = await GET(request, { params });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe(testUser.id);
      expect(body.user.email).toBe(testUser.email);
      expect(body.user.passwordHash).toBeUndefined();
    });

    it('should return 404 for non-existent user', async () => {
      const request = createAuthRequest('GET', 'non-existent-id');
      const params = Promise.resolve({ id: 'non-existent-id' });

      const response = await GET(request, { params });
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe('User not found');
    });

    it('should return 500 when fetching user fails', async () => {
      const getUserByIdSpy = vi
        .spyOn(databaseModule, 'getUserById')
        .mockImplementation(() => {
          throw new Error('Database read error');
        });

      const request = createAuthRequest('GET', testUser.id);
      const params = Promise.resolve({ id: testUser.id });

      const response = await GET(request, { params });
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toBe('Failed to fetch user');

      getUserByIdSpy.mockRestore();
    });

    it('should return 401 without auth token', async () => {
      const request = new Request(
        `http://localhost:3000/api/users/${testUser.id}`,
        {
          method: 'GET',
        },
      ) as unknown as import('next/server').NextRequest;

      const params = Promise.resolve({ id: testUser.id });

      const response = await GET(request, { params });
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBe('Authorization header missing or invalid');
    });
  });

  describe('PUT /api/users/[id]', () => {
    it('should update user with valid auth', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const request = createAuthRequest('PUT', testUser.id, updateData);
      const params = Promise.resolve({ id: testUser.id });

      const response = await PUT(request, { params });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.user.firstName).toBe(updateData.firstName);
      expect(body.user.lastName).toBe(updateData.lastName);
      expect(body.user.fullName).toBe('Updated Name');
      expect(body.user.passwordHash).toBeUndefined();
    });

    it('should return 404 for non-existent user', async () => {
      const request = createAuthRequest('PUT', 'non-existent-id', {
        firstName: 'Updated',
      });
      const params = Promise.resolve({ id: 'non-existent-id' });

      const response = await PUT(request, { params });
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe('User not found');
    });

    it('should return 409 for duplicate email', async () => {
      // Create another user first
      const anotherUser = createUser({
        firstName: 'Another',
        lastName: 'User',
        email: 'another.unique@example.com',
        password: 'password123',
      });

      const request = createAuthRequest('PUT', testUser.id, {
        email: anotherUser.email,
      });
      const params = Promise.resolve({ id: testUser.id });

      const response = await PUT(request, { params });
      expect(response.status).toBe(409);

      const body = await response.json();
      expect(body.error).toBe('Email already exists');
    });

    it('should return 500 when updating user fails', async () => {
      const updateUserSpy = vi
        .spyOn(databaseModule, 'updateUser')
        .mockImplementation(() => {
          throw new Error('Database write error');
        });

      const request = createAuthRequest('PUT', testUser.id, {
        firstName: 'Error',
      });
      const params = Promise.resolve({ id: testUser.id });

      const response = await PUT(request, { params });
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toBe('Failed to update user');

      updateUserSpy.mockRestore();
    });

    it('should return 401 without auth token', async () => {
      const request = new Request(
        `http://localhost:3000/api/users/${testUser.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName: 'Updated' }),
        },
      ) as unknown as import('next/server').NextRequest;

      const params = Promise.resolve({ id: testUser.id });

      const response = await PUT(request, { params });
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/users/[id]', () => {
    it('should delete user with valid auth', async () => {
      // Create a user to delete
      const userToDelete = createUser({
        firstName: 'To',
        lastName: 'Delete',
        email: 'to.delete@example.com',
        password: 'password123',
      });

      const request = createAuthRequest('DELETE', userToDelete.id);
      const params = Promise.resolve({ id: userToDelete.id });

      const response = await DELETE(request, { params });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it('should return 404 for non-existent user', async () => {
      const request = createAuthRequest('DELETE', 'non-existent-id');
      const params = Promise.resolve({ id: 'non-existent-id' });

      const response = await DELETE(request, { params });
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe('User not found');
    });

    it('should return 500 when deleting user fails', async () => {
      const deleteUserSpy = vi
        .spyOn(databaseModule, 'deleteUser')
        .mockImplementation(() => {
          throw new Error('Database delete error');
        });

      const request = createAuthRequest('DELETE', testUser.id);
      const params = Promise.resolve({ id: testUser.id });

      const response = await DELETE(request, { params });
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toBe('Failed to delete user');

      deleteUserSpy.mockRestore();
    });

    it('should return 401 without auth token', async () => {
      const request = new Request(
        `http://localhost:3000/api/users/${testUser.id}`,
        {
          method: 'DELETE',
        },
      ) as unknown as import('next/server').NextRequest;

      const params = Promise.resolve({ id: testUser.id });

      const response = await DELETE(request, { params });
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent user in delete', async () => {
      const headers = new Headers();
      headers.set('authorization', `Bearer ${authToken}`);

      const request = new Request(
        `http://localhost:3000/api/users/${testUser.id}`,
        {
          method: 'DELETE',
          headers: Object.fromEntries(headers.entries()),
        },
      ) as unknown as import('next/server').NextRequest;

      const params = Promise.resolve({ id: 'non-existent-id-12345' });

      const response = await DELETE(request, { params });
      expect(response.status).toBe(404);
    });
  });
});
