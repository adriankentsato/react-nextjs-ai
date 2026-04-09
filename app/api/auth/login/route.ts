import { NextRequest } from 'next/server';
import { getUserByEmail } from '@/app/lib/database';
import { generateTokens } from '@/app/lib/token-service';
import {
  apiHandler,
  ApiRequest,
  SuccessResponse,
  ErrorResponse,
} from '@/app/lib/api-handler';
import crypto from 'crypto';

function verifyPassword(password: string, passwordHash: string): boolean {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  return hash === passwordHash;
}

async function loginHandler(request: ApiRequest): Promise<SuccessResponse> {
  const body = (await request.json()) as {
    username?: string;
    email?: string;
    password: string;
  };

  const { username, email, password } = body;

  if (!password) {
    throw ErrorResponse.badRequest('Password is required');
  }

  if (!username && !email) {
    throw ErrorResponse.badRequest('Username or email is required');
  }

  const identifier = email || username;
  if (!identifier) {
    throw ErrorResponse.badRequest('Username or email is required');
  }

  const user = getUserByEmail(identifier);

  if (!user) {
    throw ErrorResponse.unauthorized('Invalid credentials');
  }

  if (!user.isActive) {
    throw ErrorResponse.unauthorized('Account is deactivated');
  }

  const isPasswordValid = verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw ErrorResponse.unauthorized('Invalid credentials');
  }

  const tokens = generateTokens(user.id, user.email);

  return SuccessResponse.ok({
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      email: user.email,
    },
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    },
  });
}

export const POST = (request: NextRequest) =>
  apiHandler([loginHandler])(request);
