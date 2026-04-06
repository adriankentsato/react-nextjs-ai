import { NextRequest, NextResponse } from 'next/server';
import { createUser, getAllUsers, CreateUserInput } from '@/app/lib/database';
import { authenticateRequest } from '@/app/lib/auth-middleware';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = authenticateRequest(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const users = getAllUsers();
    const safeUsers = users.map(user => {
      const { passwordHash: _passwordHash, ...safeUser } = user;
      return safeUser;
    });
    return NextResponse.json({ users: safeUsers });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = authenticateRequest(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const body = (await request.json()) as CreateUserInput;

    if (!body.firstName || !body.lastName || !body.email || !body.password) {
      return NextResponse.json(
        { error: 'firstName, lastName, email, and password are required' },
        { status: 400 },
      );
    }

    const user = createUser(body);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return NextResponse.json({ user: safeUser }, { status: 201 });
  } catch (_error) {
    if ((_error as Error).message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 },
    );
  }
}
