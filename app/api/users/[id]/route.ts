import { NextRequest } from 'next/server';
import {
  getUserById,
  updateUser,
  deleteUser,
  UpdateUserInput,
} from '@/app/lib/database';
import {
  apiHandler,
  SuccessResponse,
  ErrorResponse,
} from '@/app/lib/api-handler';
import {
  apiAuthMiddleware,
  ApiAuthenticatedRequest,
} from '@/app/lib/auth-middleware';

interface Params {
  id: string;
}

interface HandlerRequest extends ApiAuthenticatedRequest {
  params?: Params;
}

function createGetUserHandler(paramsPromise: Promise<Params>) {
  return async function getUserHandler(
    request: HandlerRequest,
  ): Promise<SuccessResponse> {
    const { id } = await paramsPromise;
    request.params = { id };

    try {
      const user = getUserById(id);

      if (!user) {
        throw ErrorResponse.notFound('User not found');
      }

      const { passwordHash: _passwordHash, ...safeUser } = user;
      return SuccessResponse.ok({ user: safeUser });
    } catch (error) {
      if (error instanceof ErrorResponse) {
        throw error;
      }
      throw ErrorResponse.internalServerError('Failed to fetch user');
    }
  };
}

function createUpdateUserHandler(paramsPromise: Promise<Params>) {
  return async function updateUserHandler(
    request: HandlerRequest,
  ): Promise<SuccessResponse> {
    const { id } = await paramsPromise;
    request.params = { id };

    const body = (await request.json()) as UpdateUserInput;

    try {
      const user = updateUser(id, body);

      if (!user) {
        throw ErrorResponse.notFound('User not found');
      }

      const { passwordHash: _passwordHash, ...safeUser } = user;
      return SuccessResponse.ok({ user: safeUser });
    } catch (error) {
      if (error instanceof ErrorResponse) {
        throw error;
      }
      if ((error as Error).message.includes('UNIQUE constraint failed')) {
        throw ErrorResponse.conflict('Email already exists');
      }
      throw ErrorResponse.internalServerError('Failed to update user');
    }
  };
}

function createDeleteUserHandler(paramsPromise: Promise<Params>) {
  return async function deleteUserHandler(
    request: HandlerRequest,
  ): Promise<SuccessResponse> {
    const { id } = await paramsPromise;
    request.params = { id };

    try {
      const deleted = deleteUser(id);

      if (!deleted) {
        throw ErrorResponse.notFound('User not found');
      }

      return SuccessResponse.ok({ success: true });
    } catch (error) {
      if (error instanceof ErrorResponse) {
        throw error;
      }
      throw ErrorResponse.internalServerError('Failed to delete user');
    }
  };
}

export const GET = (
  request: NextRequest,
  { params }: { params: Promise<Params> },
) => apiHandler([apiAuthMiddleware, createGetUserHandler(params)])(request);

export const PUT = (
  request: NextRequest,
  { params }: { params: Promise<Params> },
) => apiHandler([apiAuthMiddleware, createUpdateUserHandler(params)])(request);

export const DELETE = (
  request: NextRequest,
  { params }: { params: Promise<Params> },
) => apiHandler([apiAuthMiddleware, createDeleteUserHandler(params)])(request);
