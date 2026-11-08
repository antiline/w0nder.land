/** `/posts/{uuid}-{encodeURIComponent(title)}` 에서 slug 부분만 (앞의 `/posts/` 제외) */
export function getPostSlug(uuid: string, title: string) {
  return `${uuid}-${encodeURIComponent(title)}`;
}

export const getPostUrl = (uuid: string, title: string) => `/posts/${getPostSlug(uuid, title)}`;
