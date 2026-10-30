import { NextRequest, NextResponse } from 'next/server';
import {
  translateCJKTitleIfNeeded,
  translateCJKTitlesBatch,
} from '@/lib/cjk-translate-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (Array.isArray(body.titles)) {
      const validTitles = body.titles
        .filter((t: unknown): t is string => typeof t === 'string')
        .slice(0, 50);
      const translations = await translateCJKTitlesBatch(validTitles);
      return NextResponse.json({ translations });
    }

    if (typeof body.title === 'string') {
      const translatedTitle = await translateCJKTitleIfNeeded(body.title);
      return NextResponse.json({
        translatedTitle,
        translations: { [body.title]: translatedTitle },
      });
    }

    return NextResponse.json(
      { error: 'Provide either "title" (string) or "titles" (string[]).' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to translate CJK tab titles.',
      },
      { status: 500 }
    );
  }
}
