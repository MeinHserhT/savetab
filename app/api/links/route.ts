import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseSnapshot, insertLink, updateLinkById } from '@/lib/db';
import {
  extractYouTubeVideoId,
  isGenericPlaceholderTitle,
  scrapeUrlMetadata,
  validateAndNormalizeUrl,
} from '@/lib/scraper';
import { LinkStatus } from '@/lib/types';
import {
  attachUserCookie,
  resolveUserIdFromRequest,
} from '@/lib/user-session';

export async function GET(request: NextRequest) {
  const userId = resolveUserIdFromRequest(request);
  let snapshot = getDatabaseSnapshot(userId);

  const needsRepair = snapshot.links.filter((link) => {
    try {
      const parsed = new URL(link.url);
      const isYt = Boolean(extractYouTubeVideoId(parsed));
      return (
        isGenericPlaceholderTitle(link.title) ||
        (isYt &&
          (!link.video_duration ||
            link.title.toLowerCase().startsWith('watch ') ||
            link.title.startsWith('YouTube Clip (')))
      );
    } catch {
      return false;
    }
  });

  if (needsRepair.length > 0) {
    await Promise.all(
      needsRepair.map(async (item) => {
        const refreshed = await scrapeUrlMetadata(item.url);
        const shouldUpdateTitle =
          refreshed.title && !isGenericPlaceholderTitle(refreshed.title);
        if (shouldUpdateTitle || refreshed.video_duration) {
          updateLinkById(
            item.id,
            {
              title: shouldUpdateTitle ? refreshed.title : item.title,
              description: shouldUpdateTitle
                ? refreshed.description
                : item.description,
              image_url: refreshed.image_url || item.image_url,
              reading_minutes: refreshed.reading_minutes,
              video_duration: refreshed.video_duration ?? item.video_duration,
            },
            userId
          );
        }
      })
    );
    snapshot = getDatabaseSnapshot(userId);
  }

  const response = NextResponse.json({
    links: snapshot.links,
    folders: snapshot.folders,
    user: snapshot.user,
  });
  return attachUserCookie(response, userId);
}

export async function POST(request: NextRequest) {
  try {
    const userId = resolveUserIdFromRequest(request);
    const body = await request.json();
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (!rawUrl) {
      return NextResponse.json(
        { error: 'A valid HTTP/HTTPS URL is required.' },
        { status: 400 }
      );
    }

    try {
      validateAndNormalizeUrl(rawUrl);
    } catch (validationErr) {
      return NextResponse.json(
        {
          error:
            validationErr instanceof Error
              ? validationErr.message
              : 'Invalid URL format.',
        },
        { status: 400 }
      );
    }

    const scraped = await scrapeUrlMetadata(rawUrl);

    const customTitle =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : scraped.title;
    const customDescription =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : scraped.description;
    const folderId =
      typeof body.folder_id === 'string' && body.folder_id.trim()
        ? body.folder_id.trim()
        : null;
    const tags = Array.isArray(body.tags)
      ? body.tags
          .map((t: unknown) => String(t).trim().toLowerCase())
          .filter(Boolean)
      : ['reference'];
    const status =
      body.status && Object.values(LinkStatus).includes(body.status)
        ? (body.status as LinkStatus)
        : LinkStatus.UNREAD;

    const created = insertLink({
      user_id: userId,
      url: scraped.url,
      domain: scraped.domain,
      title: customTitle,
      description: customDescription,
      image_url:
        typeof body.image_url === 'string' && body.image_url.trim()
          ? body.image_url.trim()
          : scraped.image_url,
      favicon: scraped.favicon,
      folder_id: folderId,
      tags: tags.length > 0 ? tags : ['reference'],
      reading_minutes: scraped.reading_minutes,
      video_duration: scraped.video_duration ?? null,
      scrape_status: scraped.scrape_status,
      status,
    });

    const snapshot = getDatabaseSnapshot(userId);
    const response = NextResponse.json(
      {
        link: created,
        links: snapshot.links,
        folders: snapshot.folders,
        scrapeDiagnostics: scraped.diagnostics,
      },
      { status: 201 }
    );
    return attachUserCookie(response, userId);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create link entry.',
      },
      { status: 500 }
    );
  }
}
