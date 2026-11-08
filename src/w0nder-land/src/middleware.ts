import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isLegacyHardcodedSlug, LEGACY_HARDCODED_POST_TARGET } from '@/libs/routing/post-routes';

/** 구 글 permalink 가 하드코딩된 UUID 였을 때 → 글 1 로 합류(307). 이후 bare ID 규칙으로 permalink 가 된다. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const m = pathname.match(/^\/posts\/(.+)$/);
  if (!m) {
    return NextResponse.next();
  }
  const slug = m[1];
  if (isLegacyHardcodedSlug(slug)) {
    return NextResponse.redirect(new URL(LEGACY_HARDCODED_POST_TARGET, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/posts/:slug*'],
};
