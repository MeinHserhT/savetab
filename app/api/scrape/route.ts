import { NextRequest, NextResponse } from 'next/server';
import {
  parseHtmlMetadata,
  scrapeUrlMetadata,
  validateAndNormalizeUrl,
} from '@/lib/scraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (!rawUrl) {
      return NextResponse.json(
        { error: 'URL is required for metadata inspection.' },
        { status: 400 }
      );
    }

    try {
      validateAndNormalizeUrl(rawUrl);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid URL format.' },
        { status: 400 }
      );
    }

    // If raw HTML fixture is supplied (e.g. from Scraper Lab or integration test), parse deterministically
    if (typeof body.htmlFixture === 'string') {
      const metadata = parseHtmlMetadata(body.htmlFixture, rawUrl);
      return NextResponse.json({ metadata });
    }

    const metadata = await scrapeUrlMetadata(rawUrl);
    return NextResponse.json({ metadata });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Scraper inspection failed.',
      },
      { status: 500 }
    );
  }
}
