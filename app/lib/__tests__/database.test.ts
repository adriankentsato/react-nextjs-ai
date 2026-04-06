import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createUser,
  getUserById,
  getUserByEmail,
  getAllUsers,
  updateUser,
  deleteUser,
  User,
  getDb,
  resetDb,
} from '../database';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = './data/test.db';

describe('Database Service', () => {
  let testUser: User;

  beforeAll(() => {
    process.env.DB_PATH = TEST_DB_PATH;
    // Clean up test db
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  afterAll(() => {
    // Clean up test db
    const dir = path.dirname(TEST_DB_PATH);
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-shm`);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    }
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  });

  it('should create a user with all required fields', () => {
    const user = createUser({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'securepassword123',
    });

    testUser = user;

    expect(user.id).toBeDefined();
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.fullName).toBe('John Doe');
    expect(user.email).toBe('john.doe@example.com');
    expect(user.passwordHash).toBeDefined();
    expect(user.isActive).toBe(true);
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  });

  it('should get user by id', () => {
    const found = getUserById(testUser.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(testUser.id);
    expect(found?.fullName).toBe('John Doe');
  });

  it('should get user by email', () => {
    const found = getUserByEmail(testUser.email);
    expect(found).not.toBeNull();
    expect(found?.email).toBe(testUser.email);
  });

  it('should get all users', () => {
    const users = getAllUsers();
    expect(users.length).toBeGreaterThan(0);
    expect(users.some((u: User) => u.id === testUser.id)).toBe(true);
  });

  it('should update user fields', () => {
    const updated = updateUser(testUser.id, {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
    });

    expect(updated).not.toBeNull();
    expect(updated?.firstName).toBe('Jane');
    expect(updated?.lastName).toBe('Smith');
    expect(updated?.fullName).toBe('Jane Smith');
    expect(updated?.email).toBe('jane.smith@example.com');
  });

  it('should update password', () => {
    const oldHash = getUserById(testUser.id)?.passwordHash;
    const updated = updateUser(testUser.id, { password: 'newpassword456' });

    expect(updated).not.toBeNull();
    expect(updated?.passwordHash).not.toBe(oldHash);
  });

  it('should deactivate user', () => {
    const updated = updateUser(testUser.id, { isActive: false });
    expect(updated?.isActive).toBe(false);
  });

  it('should return null when getting non-existent user', () => {
    const found = getUserById('non-existent-id');
    expect(found).toBeNull();
  });

  it('should return null when updating non-existent user', () => {
    const updated = updateUser('non-existent-id', { firstName: 'Test' });
    expect(updated).toBeNull();
  });

  it('should delete user', () => {
    const deleted = deleteUser(testUser.id);
    expect(deleted).toBe(true);

    const found = getUserById(testUser.id);
    expect(found).toBeNull();
  });

  it('should return false when deleting non-existent user', () => {
    const deleted = deleteUser('non-existent-id');
    expect(deleted).toBe(false);
  });

  it('should update only firstName and keep lastName for fullName', () => {
    const user = createUser({
      firstName: 'Original',
      lastName: 'Name',
      email: 'update.first@example.com',
      password: 'testpass123',
    });

    const updated = updateUser(user.id, { firstName: 'NewFirst' });
    expect(updated?.firstName).toBe('NewFirst');
    expect(updated?.lastName).toBe('Name');
    expect(updated?.fullName).toBe('NewFirst Name');
  });

  it('should update only lastName and keep firstName for fullName', () => {
    const user = createUser({
      firstName: 'Original',
      lastName: 'Name',
      email: 'update.last@example.com',
      password: 'testpass123',
    });

    const updated = updateUser(user.id, { lastName: 'NewLast' });
    expect(updated?.firstName).toBe('Original');
    expect(updated?.lastName).toBe('NewLast');
    expect(updated?.fullName).toBe('Original NewLast');
  });

  it('should update isActive to true', () => {
    const user = createUser({
      firstName: 'Active',
      lastName: 'User',
      email: 'active.user@example.com',
      password: 'testpass123',
    });

    updateUser(user.id, { isActive: false });
    const updated = updateUser(user.id, { isActive: true });
    expect(updated?.isActive).toBe(true);
  });

  it('should use default DB_PATH when env var not set', () => {
    const originalPath = process.env.DB_PATH;
    delete process.env.DB_PATH;
    resetDb();

    const db = getDb();
    expect(db).toBeDefined();

    // Restore
    process.env.DB_PATH = originalPath;
    resetDb();
  });
});
