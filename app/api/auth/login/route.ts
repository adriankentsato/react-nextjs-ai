import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/app/lib/database';
import { generateTokens } from '@/app/lib/token-service';
import crypto from 'crypto';

function verifyPassword(password: string, passwordHash: string): boolean {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  return hash === passwordHash;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      username?: string;
      email?: string;
      password: string;
    };

    const { username, email, password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 },
      );
    }

    if (!username && !email) {
      return NextResponse.json(
        { error: 'Username or email is required' },
        { status: 400 },
      );
    }

    const identifier = email || username;
    const user = getUserByEmail(identifier);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 401 },
      );
    }

    const isPasswordValid = verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 },
      );
    }

    const tokens = generateTokens(user.id, user.email);

    return NextResponse.json({
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
  } catch (_error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
