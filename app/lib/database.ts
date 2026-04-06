import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

let dbInstance: Database.Database | null = null;

function getDbPath(): string {
  return process.env.DB_PATH || './data/app.db';
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  passwordHash: string;
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

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(getDbPath());
    dbInstance.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return dbInstance;
}

export function resetDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function initializeSchema(): void {
  const db = dbInstance!;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
}

export function createUser(input: CreateUserInput): User {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const fullName = `${input.firstName} ${input.lastName}`;
  const passwordHash = hashPassword(input.password);

  const stmt = db.prepare(`
    INSERT INTO users (id, first_name, last_name, full_name, email, password_hash, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.firstName,
    input.lastName,
    fullName,
    input.email,
    passwordHash,
    now,
    now,
    1,
  );

  return {
    id,
    firstName: input.firstName,
    lastName: input.lastName,
    fullName,
    email: input.email,
    passwordHash,
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };
}

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  is_active: number;
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    | UserRow
    | undefined;

  if (!row) return null;

  return mapRowToUser(row);
}

export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | UserRow
    | undefined;

  if (!row) return null;

  return mapRowToUser(row);
}

export function getAllUsers(): User[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM users ORDER BY created_at DESC')
    .all() as UserRow[];

  return rows.map(mapRowToUser);
}

export function updateUser(id: string, input: UpdateUserInput): User | null {
  const db = getDb();
  const user = getUserById(id);

  if (!user) return null;

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (input.firstName !== undefined) {
    updates.push('first_name = ?');
    values.push(input.firstName);
  }

  if (input.lastName !== undefined) {
    updates.push('last_name = ?');
    values.push(input.lastName);
  }

  if (input.firstName !== undefined || input.lastName !== undefined) {
    const newFirst = input.firstName ?? user.firstName;
    const newLast = input.lastName ?? user.lastName;
    updates.push('full_name = ?');
    values.push(`${newFirst} ${newLast}`);
  }

  if (input.email !== undefined) {
    updates.push('email = ?');
    values.push(input.email);
  }

  if (input.password !== undefined) {
    updates.push('password_hash = ?');
    values.push(hashPassword(input.password));
  }

  if (input.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(input.isActive ? 1 : 0);
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
  );

  stmt.run(...values);

  return getUserById(id);
}

export function deleteUser(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

function mapRowToUser(row: UserRow): User {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active === 1,
  };
}
