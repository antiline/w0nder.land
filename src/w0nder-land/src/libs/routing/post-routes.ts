/**
 * 글 주소 해석 계약(W4, #9). 기존 원더랜드의 모든 글 주소를 한 곳에서 해석한다.
 *
 * 주소는 글의 permalink(`post.url`)에서 나온다. 현재 제목에서 다시 만들지 않는다.
 * 파일 원천에서는 permalink 가 `/posts/{id}-{encodeURIComponent(title)}` 라 지금까지와 같고,
 * 모코 원천에서는 처음 공개될 때 고정된 permalink 라서 제목을 바꿔도 주소가 남는다.
 *
 * `uuid` 라는 필드 이름과 달리 실제 값은 폴더 ID(숫자 문자열, 하이픈 없음)다.
 * HTTP 동작(200·307·404)과 클라이언트 이동(router.replace)은 페이지가 맡고, 이 모듈은 판정만 한다.
 */
import type { Post } from '@/repository/post-types';

/** 예전에 permalink 로 쓰던 하드코딩 UUID. 이 값(또는 `{값}-…`)은 /posts/1 로 307 (middleware). */
export const LEGACY_HARDCODED_POST_SLUG = '28626b62da0242528bfe5f6873bb32bb';
export const LEGACY_HARDCODED_POST_TARGET = '/posts/1';

const POSTS_PREFIX = '/posts/';

/** permalink 의 slug 부분(인코딩된 그대로). */
export function encodedSlugOf(post: Pick<Post, 'url'>): string {
  if (!post.url.startsWith(POSTS_PREFIX)) {
    throw new Error(`글 permalink 형식이 아니다: ${post.url}`);
  }
  return post.url.slice(POSTS_PREFIX.length);
}

/**
 * Next 가 `[slug]` 로 넘기는 값(요청 경로를 한 번 디코딩한 문자열). getStaticPaths 에 이 값을 줘야
 * permalink 주소로 prerender 된다(#15).
 */
export function routeParamOf(post: Pick<Post, 'url'>): string {
  return decodeURIComponent(encodedSlugOf(post));
}

export type PostSlugMatch =
  /** permalink 그대로 */
  | 'permalink'
  /** 퍼센트를 한 번 더 인코딩한 legacy 주소(기존에 200 이었다) */
  | 'encodedAlias'
  /** `/posts/{id}`. 서버는 200 으로 렌더하고 클라이언트가 permalink 로 replace 한다 */
  | 'bareId';

/** 디코딩된 slug → 글. 임의 제목·없는 ID 는 null(404). */
export function resolvePostSlug(slug: string, posts: Post[]): { post: Post; matched: PostSlugMatch } | null {
  const byPermalink = posts.find(p => routeParamOf(p) === slug);
  if (byPermalink) {
    return { post: byPermalink, matched: 'permalink' };
  }
  const byEncoded = posts.find(p => encodedSlugOf(p) === slug);
  if (byEncoded) {
    return { post: byEncoded, matched: 'encodedAlias' };
  }
  const byId = posts.find(p => p.uuid === slug);
  if (byId) {
    return { post: byId, matched: 'bareId' };
  }
  return null;
}

/** `/s/{code}` → 글. 없으면 null(페이지가 /posts 로 307). */
export function resolveShortCode(code: string, posts: Post[]): Post | null {
  return posts.find(p => p.shortUrl === `/s/${code}`) ?? null;
}

/** `/posts/latest` → 목록 첫 글(createdAt 내림차순). */
export function latestPost(posts: Post[]): Post | null {
  return posts[0] ?? null;
}

/** 하드코딩 UUID 주소인지. middleware 가 쓴다. */
export function isLegacyHardcodedSlug(slug: string): boolean {
  return slug === LEGACY_HARDCODED_POST_SLUG || slug.startsWith(`${LEGACY_HARDCODED_POST_SLUG}-`);
}
