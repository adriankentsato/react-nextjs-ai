import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST } from '@/app/api/auth/refresh/route';
import { generateTokens, refreshTokens } from '@/app/lib/token-service';
import { createUser, User, resetDb } from '@/app/lib/database';
import fs from 'fs';

const TEST_DB_PATH = './data/test-refresh.db';

describe('Refresh Token Endpoint', () => {
  let testUser: User;
  let validRefreshToken: string;

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
      firstName: 'Refresh',
      lastName: 'Test',
      email: 'refresh.test.auth@example.com',
      password: 'testpassword123',
    });

    const tokens = generateTokens(testUser.id, testUser.email);
    validRefreshToken = tokens.refreshToken;
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

  const createRequest = (body: object) => {
    return new Request('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  it('should refresh with valid refresh token', async () => {
    const request = createRequest({
      refreshToken: validRefreshToken,
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.tokens).toBeDefined();
    expect(body.data.tokens.accessToken).toBeDefined();
    expect(body.data.tokens.refreshToken).toBeDefined();
    expect(body.data.tokens.expiresIn).toBe(1800);
  });

  it('should return 400 when refresh token is missing', async () => {
    const request = createRequest({});

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Refresh token is required');
  });

  it('should return 401 for invalid refresh token', async () => {
    const request = createRequest({
      refreshToken: 'invalid.token.here',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Invalid or expired refresh token');
  });

  it('should return 401 for already used refresh token', async () => {
    const tokens = generateTokens(testUser.id, testUser.email);
    refreshTokens(tokens.refreshToken);

    const request = createRequest({
      refreshToken: tokens.refreshToken,
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Invalid or expired refresh token');
  });

  it('should return 500 for internal server error', async () => {
    const request = new Request('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json{',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Internal server error');
  });
});
