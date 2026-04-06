import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { createUser, User, updateUser, resetDb } from '@/app/lib/database';
import fs from 'fs';

const TEST_DB_PATH = './data/test-login.db';

describe('Login Endpoint', () => {
  let testUser: User;

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
      firstName: 'Login',
      lastName: 'Test',
      email: 'login.test.auth@example.com',
      password: 'testpassword123',
    });
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
    return new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  it('should login with valid email and password', async () => {
    const request = createRequest({
      email: testUser.email,
      password: 'testpassword123',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testUser.email);
    expect(body.user.id).toBe(testUser.id);
    expect(body.user.passwordHash).toBeUndefined();

    expect(body.tokens).toBeDefined();
    expect(body.tokens.accessToken).toBeDefined();
    expect(body.tokens.refreshToken).toBeDefined();
    expect(body.tokens.expiresIn).toBe(1800);
  });

  it('should login with username (email)', async () => {
    const request = createRequest({
      username: testUser.email,
      password: 'testpassword123',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.user.email).toBe(testUser.email);
    expect(body.tokens).toBeDefined();
  });

  it('should return 400 when password is missing', async () => {
    const request = createRequest({
      email: testUser.email,
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Password is required');
  });

  it('should return 400 when email and username are missing', async () => {
    const request = createRequest({
      password: 'testpassword123',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Username or email is required');
  });

  it('should return 401 for invalid credentials', async () => {
    const request = createRequest({
      email: 'nonexistent@example.com',
      password: 'wrongpassword',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Invalid credentials');
  });

  it('should return 401 for wrong password', async () => {
    const request = createRequest({
      email: testUser.email,
      password: 'wrongpassword',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Invalid credentials');
  });

  it('should return 401 for deactivated account', async () => {
    const deactivatedUser = createUser({
      firstName: 'Deactivated',
      lastName: 'User',
      email: 'deactivated.login.test@example.com',
      password: 'testpassword123',
    });

    updateUser(deactivatedUser.id, { isActive: false });

    const request = createRequest({
      email: deactivatedUser.email,
      password: 'testpassword123',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('Account is deactivated');
  });

  it('should return 500 for internal server error', async () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
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
