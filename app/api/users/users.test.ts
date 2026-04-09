import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GET, POST } from '@/app/api/users/route';
import { createUser, User, resetDb } from '@/app/lib/database';
import * as databaseModule from '@/app/lib/database';
import { generateTokens } from '@/app/lib/token-service';
import fs from 'fs';

const TEST_DB_PATH = './data/test-users-api.db';

describe('Users API - List and Create', () => {
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
      email: 'api.users@example.com',
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
    body?: object,
  ): import('next/server').NextRequest => {
    const headers = new Headers();
    headers.set('authorization', `Bearer ${authToken}`);

    return new Request('http://localhost:3000/api/users', {
      method,
      headers: {
        ...Object.fromEntries(headers.entries()),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }) as unknown as import('next/server').NextRequest;
  };

  describe('GET /api/users', () => {
    it('should return list of users with valid auth', async () => {
      const request = createAuthRequest('GET');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.data.users).toBeDefined();
      expect(Array.isArray(body.data.users)).toBe(true);
      expect(body.data.users.length).toBeGreaterThan(0);

      // Check that passwordHash is not exposed
      const user = body.data.users.find((u: User) => u.id === testUser.id);
      expect(user).toBeDefined();
      expect(user.passwordHash).toBeUndefined();
    });

    it('should return 500 when listing users fails', async () => {
      const getAllUsersSpy = vi
        .spyOn(databaseModule, 'getAllUsers')
        .mockImplementation(() => {
          throw new Error('Database read error');
        });

      const request = createAuthRequest('GET');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Failed to fetch users');

      getAllUsersSpy.mockRestore();
    });

    it('should return 401 without auth token', async () => {
      const request = new Request('http://localhost:3000/api/users', {
        method: 'GET',
      }) as unknown as import('next/server').NextRequest;

      const response = await GET(request);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBe('Authorization header missing or invalid');
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user with valid auth', async () => {
      const newUser = {
        firstName: 'New',
        lastName: 'User',
        email: 'new.user@example.com',
        password: 'newpassword123',
      };

      const request = createAuthRequest('POST', newUser);
      const response = await POST(request);

      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.data.user).toBeDefined();
      expect(body.data.user.firstName).toBe(newUser.firstName);
      expect(body.data.user.lastName).toBe(newUser.lastName);
      expect(body.data.user.email).toBe(newUser.email);
      expect(body.data.user.passwordHash).toBeUndefined();
    });

    it('should return 400 when required fields are missing', async () => {
      const request = createAuthRequest('POST', {
        firstName: 'New',
        // Missing lastName, email, password
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe(
        'firstName, lastName, email, and password are required',
      );
    });

    it('should return 409 for duplicate email', async () => {
      const request = createAuthRequest('POST', {
        firstName: 'Duplicate',
        lastName: 'User',
        email: testUser.email,
        password: 'password123',
      });

      const response = await POST(request);
      expect(response.status).toBe(409);

      const body = await response.json();
      expect(body.error).toBe('Email already exists');
    });

    it('should return 401 without auth token', async () => {
      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'New',
          lastName: 'User',
          email: 'another@example.com',
          password: 'password123',
        }),
      }) as unknown as import('next/server').NextRequest;

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should return 500 for internal server error', async () => {
      const createUserSpy = vi
        .spyOn(databaseModule, 'createUser')
        .mockImplementation(() => {
          throw new Error('Database error');
        });

      const newUser = {
        firstName: 'Error',
        lastName: 'Test',
        email: 'error.test@example.com',
        password: 'password123',
      };

      const request = createAuthRequest('POST', newUser);
      const response = await POST(request);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toBe('Failed to create user');

      createUserSpy.mockRestore();
    });
  });
});
