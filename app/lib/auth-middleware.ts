import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, TokenPayload } from './token-service';
import { ApiRequest, ErrorResponse } from './api-handler';

export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload;
}

export interface ApiAuthenticatedRequest extends ApiRequest {
  user?: TokenPayload;
}

export function authenticateRequest(
  request: NextRequest,
):
  | { user: TokenPayload; response?: never }
  | { user?: never; response: NextResponse } {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      response: NextResponse.json(
        { error: 'Authorization header missing or invalid' },
        { status: 401 },
      ),
    };
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return {
      response: NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 },
      ),
    };
  }

  return { user: payload };
}

export function withAuth(
  handler: (
    request: AuthenticatedRequest,
    user: TokenPayload,
  ) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = authenticateRequest(request);

    if (authResult.response) {
      return authResult.response;
    }

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = authResult.user;

    return handler(authenticatedRequest, authResult.user);
  };
}

export function apiAuthMiddleware(request: ApiAuthenticatedRequest): void {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ErrorResponse.unauthorized('Authorization header missing or invalid');
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    throw ErrorResponse.unauthorized('Invalid or expired token');
  }

  request.user = payload;
}
