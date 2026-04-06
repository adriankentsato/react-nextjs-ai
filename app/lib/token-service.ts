import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from './database';

const JWT_SECRET =
  process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '30m';
const REFRESH_TOKEN_EXPIRY_DAYS = 15;

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked: number;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function initializeTokenSchema(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
  `);
}

export function generateTokens(userId: string, email: string): TokenPair {
  initializeTokenSchema();

  const accessToken = jwt.sign({ userId, email, type: 'access' }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const tokenId = crypto.randomUUID();
  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh', jti: tokenId },
    JWT_SECRET,
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` },
  );

  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const tokenHash = hashToken(refreshToken);

  const stmt = db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, tokenHash, expiresAt, now, 0);

  return {
    accessToken,
    refreshToken,
    expiresIn: 30 * 60,
  };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (decoded.type !== 'access') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (decoded.type !== 'refresh') {
      return null;
    }

    const db = getDb();
    initializeTokenSchema();

    const tokenHash = hashToken(token);
    const row = db
      .prepare(
        'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0',
      )
      .get(tokenHash) as RefreshTokenRow | undefined;

    if (!row) {
      return null;
    }

    const expiresAt = new Date(row.expires_at);
    if (expiresAt < new Date()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function refreshTokens(refreshToken: string): TokenPair | null {
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return null;
  }

  revokeRefreshToken(refreshToken);

  return generateTokens(decoded.userId, decoded.email);
}

export function revokeRefreshToken(token: string): boolean {
  try {
    const db = getDb();
    initializeTokenSchema();

    const tokenHash = hashToken(token);
    const result = db
      .prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?')
      .run(tokenHash);

    return result.changes > 0;
  } catch {
    return false;
  }
}

export function revokeAllUserTokens(userId: string): boolean {
  try {
    const db = getDb();
    initializeTokenSchema();

    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(
      userId,
    );

    return true;
  } catch {
    return false;
  }
}

export function cleanupExpiredTokens(): number {
  const db = getDb();
  initializeTokenSchema();

  const now = new Date().toISOString();
  const result = db
    .prepare('DELETE FROM refresh_tokens WHERE expires_at < ? OR revoked = 1')
    .run(now);

  return result.changes;
}
