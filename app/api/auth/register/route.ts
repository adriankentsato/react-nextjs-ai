import { NextRequest } from 'next/server';
import {
  createUser,
  getUserByEmail,
  CreateUserInput,
} from '@/app/lib/database';
import { generateTokens } from '@/app/lib/token-service';
import {
  apiHandler,
  ApiRequest,
  SuccessResponse,
  ErrorResponse,
} from '@/app/lib/api-handler';
import { checkRateLimit, getClientIp } from '@/app/lib/rate-limiter';

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function registerHandler(request: ApiRequest): Promise<SuccessResponse> {
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`register:${clientIp}`, {
    maxRequests: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitResult.allowed) {
    throw ErrorResponse.tooManyRequests(
      `Rate limit exceeded. Try again after ${new Date(rateLimitResult.resetTime).toISOString()}`,
    );
  }

  const body = (await request.json()) as CreateUserInput & {
    confirmPassword?: string;
  };

  const { firstName, lastName, email, password, confirmPassword } = body;

  if (!firstName || !lastName || !email || !password) {
    throw ErrorResponse.badRequest(
      'firstName, lastName, email, and password are required',
    );
  }

  if (password.length < 8) {
    throw ErrorResponse.badRequest(
      'Password must be at least 8 characters long',
    );
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw ErrorResponse.badRequest('Passwords do not match');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw ErrorResponse.badRequest('Invalid email format');
  }

  const existingUser = getUserByEmail(email);
  if (existingUser) {
    throw ErrorResponse.conflict('Email already registered');
  }

  const user = createUser({ firstName, lastName, email, password });
  const tokens = generateTokens(user.id, user.email);

  return SuccessResponse.created({
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
  apiHandler([registerHandler])(request);
