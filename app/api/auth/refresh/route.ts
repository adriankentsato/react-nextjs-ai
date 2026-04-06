import { NextRequest, NextResponse } from 'next/server';
import { refreshTokens } from '@/app/lib/token-service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { refreshToken?: string };

    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 },
      );
    }

    const tokens = refreshTokens(refreshToken);

    if (!tokens) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
