import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  withAuth,
  AuthenticatedRequest,
} from '../auth-middleware';
import { generateTokens } from '../token-service';
import { createUser, User, resetDb } from '../database';
import fs from 'fs';

const TEST_DB_PATH = './data/test-middleware.db';

describe('Auth Middleware', () => {
  let testUser: User;
  let validAccessToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.DB_PATH = TEST_DB_PATH;
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

    testUser = createUser({
      firstName: 'Middleware',
      lastName: 'Test',
      email: 'middleware.test.auth@example.com',
      password: 'testpassword123',
    });

    const tokens = generateTokens(testUser.id, testUser.email);
    validAccessToken = tokens.accessToken;
  });

  const createRequest = (authHeader?: string): NextRequest => {
    const headers = new Headers();
    if (authHeader) {
      headers.set('authorization', authHeader);
    }
    return new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
      headers,
    });
  };

  it('should return 401 when authorization header is missing', () => {
    const request = createRequest();
    const result = authenticateRequest(request);

    expect(result.response).toBeDefined();
    expect(result.user).toBeUndefined();
    expect(result.response?.status).toBe(401);
  });

  it('should return 401 when authorization header is not Bearer', () => {
    const request = createRequest('Basic dXNlcjpwYXNz');
    const result = authenticateRequest(request);

    expect(result.response).toBeDefined();
    expect(result.user).toBeUndefined();
    expect(result.response?.status).toBe(401);
  });

  it('should return 401 when token is invalid', () => {
    const request = createRequest('Bearer invalid.token.here');
    const result = authenticateRequest(request);

    expect(result.response).toBeDefined();
    expect(result.user).toBeUndefined();
    expect(result.response?.status).toBe(401);
  });

  it('should return user when access token is valid', () => {
    const request = createRequest(`Bearer ${validAccessToken}`);
    const result = authenticateRequest(request);

    expect(result.response).toBeUndefined();
    expect(result.user).toBeDefined();
    expect(result.user?.userId).toBe(testUser.id);
    expect(result.user?.email).toBe(testUser.email);
    expect(result.user?.type).toBe('access');
  });

  it('should work with withAuth wrapper', async () => {
    const request = createRequest(`Bearer ${validAccessToken}`);

    const handler = withAuth(async (req: AuthenticatedRequest, user) => {
      expect(req.user).toBeDefined();
      expect(user.userId).toBe(testUser.id);
      return NextResponse.json({ success: true }, { status: 200 });
    });

    const response = await handler(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('should return 401 with withAuth wrapper when no token', async () => {
    const request = createRequest();

    const handler = withAuth(async () => {
      return NextResponse.json({ success: true }, { status: 200 });
    });

    const response = await handler(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Authorization header missing or invalid');
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
});
