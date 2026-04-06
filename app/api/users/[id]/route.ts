import { NextRequest, NextResponse } from 'next/server';
import {
  getUserById,
  updateUser,
  deleteUser,
  UpdateUserInput,
} from '@/app/lib/database';
import { authenticateRequest } from '@/app/lib/auth-middleware';

interface Params {
  id: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse> {
  const authResult = authenticateRequest(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const user = getUserById(id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return NextResponse.json({ user: safeUser });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse> {
  const authResult = authenticateRequest(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateUserInput;

    const user = updateUser(id, body);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return NextResponse.json({ user: safeUser });
  } catch (_error) {
    if ((_error as Error).message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse> {
  const authResult = authenticateRequest(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const deleted = deleteUser(id);

    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 },
    );
  }
}
