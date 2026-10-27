import type { NextRequest, NextResponse } from 'next/server';

export const USER_COOKIE_NAME = 'tabflow_uid';
export const USER_HEADER_NAME = 'x-tabflow-uid';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function isValidUserId(candidate: string | null | undefined): candidate is string {
  if (!candidate) return false;
  return /^usr-[a-zA-Z0-9_-]{4,48}$/.test(candidate.trim());
}

export function generateAnonymousUserId(): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `usr-${randomPart}`;
}

export function resolveUserIdFromRequest(request: NextRequest): string {
  const cookieUid = request.cookies.get(USER_COOKIE_NAME)?.value?.trim();
  if (isValidUserId(cookieUid)) {
    return cookieUid;
  }

  const headerUid = request.headers.get(USER_HEADER_NAME)?.trim();
  if (isValidUserId(headerUid)) {
    return headerUid;
  }

  return generateAnonymousUserId();
}

export function attachUserCookie(
  response: NextResponse,
  userId: string
): NextResponse {
  response.cookies.set(USER_COOKIE_NAME, userId, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    httpOnly: false,
  });
  return response;
}

export function getOrCreateClientUserId(): string {
  if (typeof window === 'undefined') {
    return 'usr-swiss-01';
  }

  const cookieMatch = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${USER_COOKIE_NAME}=`));
  const cookieValue = cookieMatch
    ? decodeURIComponent(cookieMatch.split('=')[1] ?? '').trim()
    : '';

  if (isValidUserId(cookieValue)) {
    try {
      window.localStorage.setItem(USER_COOKIE_NAME, cookieValue);
    } catch {
      // Ignore storage quota / privacy mode restrictions
    }
    return cookieValue;
  }

  try {
    const stored = window.localStorage.getItem(USER_COOKIE_NAME)?.trim();
    if (isValidUserId(stored)) {
      document.cookie = `${USER_COOKIE_NAME}=${encodeURIComponent(stored)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
      return stored;
    }
  } catch {
    // Ignore storage read restrictions
  }

  const newUid = generateAnonymousUserId();
  document.cookie = `${USER_COOKIE_NAME}=${encodeURIComponent(newUid)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  try {
    window.localStorage.setItem(USER_COOKIE_NAME, newUid);
  } catch {
    // Ignore storage write restrictions
  }
  return newUid;
}
