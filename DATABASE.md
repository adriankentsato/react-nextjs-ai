# SQLite Database Connector

This project includes a SQLite database connector service with a repository pattern implementation.

## Files Created

- `app/lib/db.ts` - Core SQLite connector class
- `app/lib/database.ts` - Main database exports and instances
- `app/lib/repositories/userRepository.ts` - User repository with CRUD operations
- `app/api/users/route.ts` - API endpoints for user collection
- `app/api/users/[id]/route.ts` - API endpoints for individual user operations

## Usage

### Basic Database Connection

```typescript
import { getDatabaseConnector } from '@/lib/database';

const db = getDatabaseConnector();
db.connect(); // Connect to SQLite database
```

### Using Repository Pattern

```typescript
import { userRepository } from '@/lib/database';

// Create user
const user = userRepository.create({
  email: 'user@example.com',
  name: 'John Doe',
  password_hash: 'hashed_password',
});

// Find user by email
const foundUser = userRepository.findByEmail('user@example.com');

// Get all users
const allUsers = userRepository.findAll();

// Update user
const updatedUser = userRepository.update(1, { name: 'Jane Doe' });

// Delete user
const deleted = userRepository.delete(1);
```

### Custom Repository

```typescript
import { SQLiteConnector, getDatabaseConnector } from '@/lib/db';

export class CustomRepository {
  private db: SQLiteConnector;

  constructor(db: SQLiteConnector) {
    this.db = db;
  }

  customQuery() {
    const stmt = this.db.prepare('SELECT * FROM custom_table');
    return stmt.all();
  }
}

const customRepo = new CustomRepository(getDatabaseConnector());
```

## API Endpoints

- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `GET /api/users/[id]` - Get user by ID
- `PUT /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user

## Database Location

The SQLite database is stored in `data/database.db` in your project root. The directory is created automatically if it doesn't exist.

## Features

- Connection pooling and management
- Transaction support
- Schema initialization
- Health checks
- Backup functionality
- Type-safe repository pattern
- RESTful API endpoints
