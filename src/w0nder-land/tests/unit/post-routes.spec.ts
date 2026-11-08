import { expect, test } from '@playwright/test';
import { getAllPosts } from '@/repository/posts';
import {
  isLegacyHardcodedSlug,
  latestPost,
  resolvePostSlug,
  resolveShortCode,
  routeParamOf,
} from '@/libs/routing/post-routes';
import { manifest, urlCases } from '../support/baseline';

const posts = getAllPosts();

/** #18 이 배포한 판정 규칙(제목에서 주소를 만든다). 새 resolver 가 파일 원천에서 이와 똑같이 판정해야 한다. */
function previousRule(slug: string) {
  const uuid = slug.includes('-') ? slug.split('-')[0]! : slug;
  const post = posts.find(p => p.uuid === uuid);
  if (!post) {
    return null;
  }
  const ok =
    slug === post.uuid ||
    slug === `${post.uuid}-${post.title}` ||
    slug === `${post.uuid}-${encodeURIComponent(post.title)}`;
  return ok ? post.uuid : null;
}

/** Next 가 [slug] 로 넘기는 값: 요청 경로의 slug 를 한 번 디코딩한 것. 깨진 인코딩은 Next 가 400 으로 막는다. */
const decodedSlug = (path: string) => {
  try {
    return decodeURIComponent(path.split('?')[0]!.slice('/posts/'.length));
  } catch {
    return null;
  }
};

test('manifest 의 모든 /posts/* 주소와 무효 입력에서 이전 규칙과 같은 글을 고른다', () => {
  const postPaths = urlCases
    .map(c => c.path)
    .filter(p => p.startsWith('/posts/') && !p.startsWith('/posts/latest') && !/\/assets\//.test(p));
  const extra = ['/posts/1-ShowYourTime 개발후기', '/posts/30-Tailscale + Caddy', '/posts/82-', '/posts/-1', '/posts/'];
  const slugs = [...postPaths, ...extra]
    .map(path => ({ path, slug: decodedSlug(path) }))
    .filter((x): x is { path: string; slug: string } => x.slug !== null && !isLegacyHardcodedSlug(x.slug));
  for (const { path, slug } of slugs) {
    expect(resolvePostSlug(slug, posts)?.post.uuid ?? null, path).toBe(previousRule(slug));
  }
  expect(slugs.length).toBeGreaterThan(300);
});

test('getStaticPaths 의 param 은 이전과 같다(디코딩된 {id}-{title})', () => {
  for (const p of posts) {
    expect(routeParamOf(p)).toBe(`${p.uuid}-${p.title}`);
  }
});

test('주소는 permalink 에서 나온다: 제목이 바뀐 글은 옛 permalink 로 열리고 새 제목 주소로는 열리지 않는다', () => {
  const original = posts.find(p => p.uuid === '3')!;
  const renamed = { ...original, title: '바뀐 제목' };
  const list = posts.map(p => (p.uuid === '3' ? renamed : p));
  expect(resolvePostSlug(routeParamOf(original), list)).toMatchObject({
    matched: 'permalink',
    post: { title: '바뀐 제목' },
  });
  expect(resolvePostSlug(original.url.slice('/posts/'.length), list)).toMatchObject({ matched: 'encodedAlias' });
  expect(resolvePostSlug('3-바뀐 제목', list)).toBeNull();
  expect(resolvePostSlug('3', list)).toMatchObject({ matched: 'bareId' });
});

test('단축 주소·latest·하드코딩 UUID', () => {
  for (const a of manifest.articles) {
    expect(resolveShortCode(a.routes.shortPath!.slice(3), posts)?.url).toBe(a.routes.canonicalPath);
  }
  expect(resolveShortCode('__missing__', posts)).toBeNull();
  expect(resolveShortCode('', posts)).toBeNull();
  expect(latestPost(posts)?.uuid).toBe(manifest.listOrder[0]);
  expect(latestPost([])).toBeNull();
  expect(isLegacyHardcodedSlug('28626b62da0242528bfe5f6873bb32bb')).toBe(true);
  expect(isLegacyHardcodedSlug('28626b62da0242528bfe5f6873bb32bb-any')).toBe(true);
  expect(isLegacyHardcodedSlug('28626b62da0242528bfe5f6873bb32b')).toBe(false);
});
