import { NextRequest, NextResponse } from 'next/server';
import {
  deleteFolderById,
  getDatabaseSnapshot,
  insertFolder,
  updateFolderById,
} from '@/lib/db';
import { TabGroupColor } from '@/lib/types';
import {
  attachUserCookie,
  resolveUserIdFromRequest,
} from '@/lib/user-session';

export async function POST(request: NextRequest) {
  try {
    const userId = resolveUserIdFromRequest(request);
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const parentId =
      typeof body.parent_id === 'string' && body.parent_id.trim()
        ? body.parent_id.trim()
        : null;
    const color =
      typeof body.color === 'string'
        ? (body.color as TabGroupColor)
        : undefined;

    if (!name) {
      return NextResponse.json(
        { error: 'Group name cannot be empty.' },
        { status: 400 }
      );
    }

    const folder = insertFolder(name, parentId, color, userId);
    const snapshot = getDatabaseSnapshot(userId);
    const response = NextResponse.json(
      { folder, folders: snapshot.folders },
      { status: 201 }
    );
    return attachUserCookie(response, userId);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create group.',
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = resolveUserIdFromRequest(request);
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json(
        { error: 'Group ID is required.' },
        { status: 400 }
      );
    }
    const folders = updateFolderById(
      id,
      {
        name: typeof body.name === 'string' ? body.name.trim() : undefined,
        color: body.color as TabGroupColor | undefined,
        collapsed:
          typeof body.collapsed === 'boolean' ? body.collapsed : undefined,
      },
      userId
    );
    return attachUserCookie(NextResponse.json({ folders }), userId);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update group.',
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = resolveUserIdFromRequest(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error: 'Group ID is required.' },
        { status: 400 }
      );
    }
    const result = deleteFolderById(id, userId);
    return attachUserCookie(NextResponse.json(result), userId);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to delete group.',
      },
      { status: 400 }
    );
  }
}
