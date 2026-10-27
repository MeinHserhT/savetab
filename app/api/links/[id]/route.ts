import { NextRequest, NextResponse } from 'next/server';
import { deleteLinkById, updateLinkById } from '@/lib/db';
import {
  attachUserCookie,
  resolveUserIdFromRequest,
} from '@/lib/user-session';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = resolveUserIdFromRequest(request);
    const { id } = await context.params;
    const body = await request.json();

    const { link, links } = updateLinkById(
      id,
      {
        title: body.title,
        description: body.description,
        folder_id: body.folder_id,
        status: body.status,
        order_index:
          typeof body.order_index === 'number' ? body.order_index : undefined,
        tags: Array.isArray(body.tags) ? body.tags : undefined,
        image_url: body.image_url,
        reading_minutes: body.reading_minutes,
      },
      userId
    );

    if (!link) {
      return NextResponse.json({ error: 'Link not found.' }, { status: 404 });
    }

    return attachUserCookie(NextResponse.json({ link, links }), userId);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update link.',
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userId = resolveUserIdFromRequest(request);
  const { id } = await context.params;
  const { deleted, links } = deleteLinkById(id, userId);

  if (!deleted) {
    return NextResponse.json({ error: 'Link not found.' }, { status: 404 });
  }

  return attachUserCookie(NextResponse.json({ deleted: true, links }), userId);
}
