/** `/posts/{uuid}-{encodeURIComponent(title)}` 에서 slug 부분만 (앞의 `/posts/` 제외) */
export function getPostSlug(uuid: string, title: string) {
  return `${uuid}-${encodeURIComponent(title)}`;
}

export const getPostUrl = (uuid: string, title: string) => `/posts/${getPostSlug(uuid, title)}`;

/**
 * Next 가 `[slug]` 에 넘기는 값은 요청 경로를 한 번 디코딩한 문자열이다.
 * getStaticPaths 에도 이 디코딩된 형태를 줘야 `getPostUrl` 주소로 prerender 된다.
 */
export function getPostRouteParam(uuid: string, title: string) {
  return `${uuid}-${title}`;
}

/**
 * 디코딩된 slug 가 이 글의 주소인지 판별한다. 허용하는 형태:
 * - `{uuid}-{title}`: 정식 주소 `getPostUrl` 로 들어온 요청
 * - `{uuid}-{encodeURIComponent(title)}`: 퍼센트를 한 번 더 인코딩한 legacy 주소 (기존에 200 이었으므로 유지)
 * - `{uuid}`: bare ID
 * 그 밖의 임의 제목은 받지 않는다.
 */
export function isPostSlugOf(slug: string, uuid: string, title: string) {
  return slug === uuid || slug === getPostRouteParam(uuid, title) || slug === getPostSlug(uuid, title);
}
