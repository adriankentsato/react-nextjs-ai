import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  refreshTokens,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
} from '../token-service';
import { createUser, User, resetDb, getDb } from '../database';
import * as databaseModule from '../database';
import fs from 'fs';
import crypto from 'crypto';

const TEST_DB_PATH = './data/test-auth.db';

describe('Token Service', () => {
  let testUser: User;
  let tokens: { accessToken: string; refreshToken: string; expiresIn: number };

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
      firstName: 'Auth',
      lastName: 'Test',
      email: 'auth.test.token@example.com',
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

  it('should generate access and refresh tokens', () => {
    tokens = generateTokens(testUser.id, testUser.email);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.expiresIn).toBe(30 * 60);
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
  });

  it('should verify valid access token', () => {
    const payload = verifyAccessToken(tokens.accessToken);

    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(testUser.id);
    expect(payload?.email).toBe(testUser.email);
    expect(payload?.type).toBe('access');
  });

  it('should verify valid refresh token', () => {
    const payload = verifyRefreshToken(tokens.refreshToken);

    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(testUser.id);
    expect(payload?.email).toBe(testUser.email);
    expect(payload?.type).toBe('refresh');
  });

  it('should reject invalid access token', () => {
    const payload = verifyAccessToken('invalid.token.here');
    expect(payload).toBeNull();
  });

  it('should reject invalid refresh token', () => {
    const payload = verifyRefreshToken('invalid.token.here');
    expect(payload).toBeNull();
  });

  it('should reject refresh token when treated as access token', () => {
    const payload = verifyAccessToken(tokens.refreshToken);
    expect(payload).toBeNull();
  });

  it('should reject access token when treated as refresh token', () => {
    const payload = verifyRefreshToken(tokens.accessToken);
    expect(payload).toBeNull();
  });

  it('should refresh tokens with valid refresh token', async () => {
    await new Promise(resolve => setTimeout(resolve, 1100));
    const newTokens = refreshTokens(tokens.refreshToken);

    expect(newTokens).not.toBeNull();
    expect(newTokens?.accessToken).not.toBe(tokens.accessToken);
    expect(newTokens?.refreshToken).not.toBe(tokens.refreshToken);
    expect(newTokens?.expiresIn).toBe(30 * 60);
  });

  it('should reject invalid refresh token for refresh operation', () => {
    const newTokens = refreshTokens('invalid.token.here');
    expect(newTokens).toBeNull();
  });

  it('should reject revoked refresh token', () => {
    const freshTokens = generateTokens(testUser.id, testUser.email);
    revokeRefreshToken(freshTokens.refreshToken);

    const newTokens = refreshTokens(freshTokens.refreshToken);
    expect(newTokens).toBeNull();
  });

  it('should revoke specific refresh token', () => {
    const freshTokens = generateTokens(testUser.id, testUser.email);
    const result = revokeRefreshToken(freshTokens.refreshToken);

    expect(result).toBe(true);

    const payload = verifyRefreshToken(freshTokens.refreshToken);
    expect(payload).toBeNull();
  });

  it('should revoke all user tokens', () => {
    const tokens1 = generateTokens(testUser.id, testUser.email);
    const tokens2 = generateTokens(testUser.id, testUser.email);

    revokeAllUserTokens(testUser.id);

    expect(verifyRefreshToken(tokens1.refreshToken)).toBeNull();
    expect(verifyRefreshToken(tokens2.refreshToken)).toBeNull();
  });

  it('should cleanup expired and revoked tokens', () => {
    generateTokens(testUser.id, testUser.email);

    const deleted = cleanupExpiredTokens();
    expect(typeof deleted).toBe('number');
  });

  it('should reject expired refresh token', () => {
    const tokens = generateTokens(testUser.id, testUser.email);
    const db = getDb();

    // Hash the token the same way the service does
    const tokenHash = crypto
      .createHash('sha256')
      .update(tokens.refreshToken)
      .digest('hex');

    // Manually expire the token in the database
    db.prepare(
      'UPDATE refresh_tokens SET expires_at = ? WHERE token_hash = ?',
    ).run(new Date(Date.now() - 1000).toISOString(), tokenHash);

    const payload = verifyRefreshToken(tokens.refreshToken);
    expect(payload).toBeNull();
  });

  it('should return false when refresh token is not found', () => {
    const result = revokeRefreshToken('invalid.token.here');
    expect(result).toBe(false);
  });

  it('should return false when revoking token fails with DB error', () => {
    const getDbSpy = vi
      .spyOn(databaseModule, 'getDb')
      .mockImplementation(() => {
        throw new Error('Database unavailable');
      });

    const result = revokeRefreshToken('token-that-triggers-error');
    expect(result).toBe(false);

    getDbSpy.mockRestore();
  });

  it('should return true when revoking all tokens for user with no tokens', () => {
    const result = revokeAllUserTokens('');
    expect(result).toBe(true);
  });

  it('should return false when revoke all user tokens fails with DB error', () => {
    const getDbSpy = vi
      .spyOn(databaseModule, 'getDb')
      .mockImplementation(() => {
        throw new Error('Database unavailable');
      });

    const result = revokeAllUserTokens(testUser.id);
    expect(result).toBe(false);

    getDbSpy.mockRestore();
  });
});
