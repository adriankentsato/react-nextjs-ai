import { NextRequest } from 'next/server';
import { refreshTokens } from '@/app/lib/token-service';
import {
  apiHandler,
  ApiRequest,
  SuccessResponse,
  ErrorResponse,
} from '@/app/lib/api-handler';

async function refreshHandler(request: ApiRequest): Promise<SuccessResponse> {
  const body = (await request.json()) as { refreshToken?: string };

  const { refreshToken } = body;

  if (!refreshToken) {
    throw ErrorResponse.badRequest('Refresh token is required');
  }

  const tokens = refreshTokens(refreshToken);

  if (!tokens) {
    throw ErrorResponse.unauthorized('Invalid or expired refresh token');
  }

  return SuccessResponse.ok({
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    },
  });
}

export const POST = (request: NextRequest) =>
  apiHandler([refreshHandler])(request);
