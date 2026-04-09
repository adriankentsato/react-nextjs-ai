import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST } from './route';
import { resetDb } from '@/app/lib/database';
import fs from 'fs';

const TEST_DB_PATH = './data/test-register.db';

const createRequest = (body: object) => {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};

describe('POST /api/auth/register', () => {
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

  it('should register a new user successfully', async () => {
    const request = createRequest({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.register.test@example.com',
      password: 'password123',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.code).toBe('CREATED');
    expect(data.data.user).toMatchObject({
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      email: 'john.register.test@example.com',
    });
    expect(data.data.user.id).toBeDefined();
    expect(data.data.tokens.accessToken).toBeDefined();
    expect(data.data.tokens.refreshToken).toBeDefined();
    expect(data.data.tokens.expiresIn).toBeDefined();
  });

  it('should return 400 when required fields are missing', async () => {
    const request = createRequest({
      email: 'test@example.com',
      password: 'password123',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('BAD_REQUEST');
  });

  it('should return 400 when password is too short', async () => {
    const request = createRequest({
      firstName: 'John',
      lastName: 'Doe',
      email: 'short.pass.test@example.com',
      password: 'short',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('BAD_REQUEST');
    expect(data.error).toContain('at least 8 characters');
  });

  it('should return 400 for invalid email format', async () => {
    const request = createRequest({
      firstName: 'John',
      lastName: 'Doe',
      email: 'invalid-email',
      password: 'password123',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('BAD_REQUEST');
    expect(data.error).toContain('Invalid email');
  });

  it('should return 400 when passwords do not match', async () => {
    const request = createRequest({
      firstName: 'John',
      lastName: 'Doe',
      email: 'mismatch.test@example.com',
      password: 'password123',
      confirmPassword: 'different123',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('BAD_REQUEST');
    expect(data.error).toContain('do not match');
  });

  it('should return 409 when email already exists', async () => {
    const userData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'duplicate.test@example.com',
      password: 'password123',
    };

    // Create first user
    await POST(
      createRequest(userData) as unknown as import('next/server').NextRequest,
    );

    // Try to create duplicate
    const response = await POST(
      createRequest(userData) as unknown as import('next/server').NextRequest,
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('CONFLICT');
    expect(data.error).toContain('already registered');
  });

  it('should accept registration with confirmPassword matching', async () => {
    const request = createRequest({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.confirm.test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    const response = await POST(
      request as unknown as import('next/server').NextRequest,
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.code).toBe('CREATED');
  });
});
