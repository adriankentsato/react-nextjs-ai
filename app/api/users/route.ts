import { NextRequest } from 'next/server';
import { createUser, getAllUsers, CreateUserInput } from '@/app/lib/database';
import {
  apiHandler,
  SuccessResponse,
  ErrorResponse,
} from '@/app/lib/api-handler';
import {
  apiAuthMiddleware,
  ApiAuthenticatedRequest,
} from '@/app/lib/auth-middleware';

async function getUsersHandler(): Promise<SuccessResponse> {
  try {
    const users = getAllUsers();
    const safeUsers = users.map(user => {
      const { passwordHash: _passwordHash, ...safeUser } = user;
      return safeUser;
    });
    return SuccessResponse.ok({ users: safeUsers });
  } catch (error) {
    if (error instanceof ErrorResponse) {
      throw error;
    }
    throw ErrorResponse.internalServerError('Failed to fetch users');
  }
}

async function createUserHandler(
  request: ApiAuthenticatedRequest,
): Promise<SuccessResponse> {
  const body = (await request.json()) as CreateUserInput;

  if (!body.firstName || !body.lastName || !body.email || !body.password) {
    throw ErrorResponse.badRequest(
      'firstName, lastName, email, and password are required',
    );
  }

  try {
    const user = createUser(body);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return SuccessResponse.created({ user: safeUser });
  } catch (error) {
    if ((error as Error).message.includes('UNIQUE constraint failed')) {
      throw ErrorResponse.conflict('Email already exists');
    }
    throw ErrorResponse.internalServerError('Failed to create user');
  }
}

export const GET = (request: NextRequest) =>
  apiHandler([apiAuthMiddleware, getUsersHandler])(request);

export const POST = (request: NextRequest) =>
  apiHandler([apiAuthMiddleware, createUserHandler])(request);
