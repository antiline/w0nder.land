import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAllPosts, getPostUuids } from '@/repository/posts';
import { comparePostLists } from '@/server/post-compare';
import {
  hrefOfPermalink,
  MoccoConfig,
  MoccoPostDetail,
  MoccoPostReader,
  MoccoReadError,
} from '@/server/mocco-post-reader';
import { FilePostReader, postReaderFromEnv, ShadowPostReader } from '@/server/post-reader';
import { getPostUrl } from '@/libs/utils/urls';

/**
 * 모코 /v1 응답을 실제 82개 글 파일로 흉내 낸다. 모코 이관(M3)은 frontmatter 와 본문을 바이트 그대로 나눠 저장한다.
 */
const postsDir = join(__dirname, '..', '..', 'public', 'posts');

function splitFrontmatter(text: string): { frontmatter: string; bodyMd: string } {
  const end = text.indexOf('\n---', 3);
  const cut = text.indexOf('\n', end + 1) + 1;
  return { frontmatter: text.slice(0, cut), bodyMd: text.slice(cut) };
}

function fakeMocco(overrides: { details?: (d: MoccoPostDetail) => MoccoPostDetail; failPath?: RegExp } = {}) {
  const details = getPostUuids().map((id, i): MoccoPostDetail => {
    const text = readFileSync(join(postsDir, id, 'post.md'), 'utf8');
    const { frontmatter, bodyMd } = splitFrontmatter(text);
    const title = /^title:\s*'(.*)'$/m.exec(frontmatter)?.[1] ?? '';
    const d: MoccoPostDetail = {
      id: `p_${i}`,
      legacyId: id,
      status: 'public',
      // 모코는 permalink 를 디코딩된 경로로 준다(모코 계약 spec "Consumer adapter").
      permalink: `/posts/${id}-${title}`,
      frontmatter,
      bodyMd,
    };
    return overrides.details ? overrides.details(d) : d;
  });
  const calls: string[] = [];
  const fetchFn = (async (url: string) => {
    const { pathname, searchParams } = new URL(url);
    const call = pathname + (searchParams.toString() ? `?${searchParams}` : '');
    calls.push(call);
    if (overrides.failPath?.test(call)) {
      return new Response('boom', { status: 500 });
    }
    if (pathname === '/v1/blog/posts') {
      const limit = Number(searchParams.get('limit'));
      const start = Number(searchParams.get('cursor') ?? 0);
      const items = details.slice(start, start + limit).map(({ id, legacyId, status }) => ({ id, legacyId, status }));
      const next = start + limit < details.length ? String(start + limit) : null;
      return Response.json({ items, nextCursor: next });
    }
    const id = decodeURIComponent(pathname.split('/').pop()!);
    const d = details.find(x => x.id === id);
    return d ? Response.json(d) : new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
  return { fetchFn, calls, details };
}

const config = (fetchFn: typeof fetch, extra: Partial<MoccoConfig> = {}): MoccoConfig => ({
  baseUrl: 'https://mocco.test',
  readKey: 'mk_sec_test',
  timeoutMs: 1_000,
  cacheMs: 60_000,
  pageSize: 30,
  concurrency: 4,
  fetch: fetchFn,
  ...extra,
});

test('모코 원천은 82개 글 모두 파일 원천과 같은 Post 를 같은 순서로 만든다', async () => {
  const { fetchFn } = fakeMocco();
  const mocco = await new MoccoPostReader(config(fetchFn)).listPublished();
  const file = getAllPosts();
  expect(file.length).toBe(82);
  expect(comparePostLists(file, mocco)).toMatchObject({ equal: true });
  expect(mocco).toEqual(file);
});

test('커서로 모든 페이지를 읽는다', async () => {
  const { fetchFn, calls } = fakeMocco();
  await new MoccoPostReader(config(fetchFn, { pageSize: 30 })).listPublished();
  expect(calls.filter(c => c.startsWith('/v1/blog/posts?'))).toEqual([
    '/v1/blog/posts?limit=30',
    '/v1/blog/posts?limit=30&cursor=30',
    '/v1/blog/posts?limit=30&cursor=60',
  ]);
});

test('페이지 중간 실패·상세 실패는 전체 실패다(부분 결과 없음)', async () => {
  for (const failPath of [/cursor=30/, /\/v1\/blog\/posts\/p_5$/]) {
    const { fetchFn } = fakeMocco({ failPath });
    await expect(new MoccoPostReader(config(fetchFn)).listPublished()).rejects.toBeInstanceOf(MoccoReadError);
  }
});

test('공개가 아닌 글, legacyId 없는 글, 형식이 틀린 permalink 는 거부한다', async () => {
  const cases: ((d: MoccoPostDetail) => MoccoPostDetail)[] = [
    d => (d.legacyId === '3' ? { ...d, status: 'draft' as 'public' } : d),
    d => (d.legacyId === '3' ? { ...d, legacyId: null } : d),
    d => (d.legacyId === '3' ? { ...d, permalink: 'https://elsewhere/3' } : d),
  ];
  for (const details of cases) {
    const { fetchFn } = fakeMocco({ details });
    await expect(new MoccoPostReader(config(fetchFn)).listPublished()).rejects.toBeInstanceOf(MoccoReadError);
  }
});

test('형식이 틀린 응답은 전체 실패다: 본문이 문자열이 아님, 필드 없음, 커서 타입, JSON 아님', async () => {
  const detailCases: ((d: MoccoPostDetail) => MoccoPostDetail)[] = [
    d => (d.legacyId === '80' ? ({ ...d, bodyMd: 123 } as unknown as MoccoPostDetail) : d),
    d => (d.legacyId === '80' ? ({ ...d, permalink: undefined } as unknown as MoccoPostDetail) : d),
  ];
  for (const details of detailCases) {
    const { fetchFn } = fakeMocco({ details });
    await expect(new MoccoPostReader(config(fetchFn)).listPublished()).rejects.toThrow(/형식이 틀렸다/);
  }
  const badCursor = (async () => Response.json({ items: [], nextCursor: 3 })) as unknown as typeof fetch;
  await expect(new MoccoPostReader(config(badCursor)).listPublished()).rejects.toThrow(/nextCursor/);
  const notJson = (async () => new Response('<html>')) as unknown as typeof fetch;
  await expect(new MoccoPostReader(config(notJson)).listPublished()).rejects.toThrow(/JSON 이 아니다/);
});

test('목록과 상세가 맞지 않거나 legacyId 가 겹치면 거부한다', async () => {
  // 상세 응답만 바꾼다(목록은 그대로).
  const detailOnly = (change: (d: MoccoPostDetail) => MoccoPostDetail) => {
    const { fetchFn } = fakeMocco();
    return (async (url: string, init: RequestInit) => {
      const res = await fetchFn(url, init);
      if (!/\/v1\/blog\/posts\/[^/?]+$/.test(new URL(url).pathname)) {
        return res;
      }
      const d = (await res.json()) as MoccoPostDetail;
      return Response.json(d.legacyId === '3' ? change(d) : d);
    }) as unknown as typeof fetch;
  };
  for (const change of [
    (d: MoccoPostDetail) => ({ ...d, id: 'other' }),
    (d: MoccoPostDetail) => ({ ...d, legacyId: '4' }),
  ]) {
    await expect(new MoccoPostReader(config(detailOnly(change))).listPublished()).rejects.toBeInstanceOf(
      MoccoReadError,
    );
  }
  const twice = (async (url: string) =>
    url.includes('/v1/blog/posts?')
      ? Response.json({
          items: [
            { id: 'a', legacyId: '1', status: 'public' },
            { id: 'b', legacyId: '1', status: 'public' },
          ],
          nextCursor: null,
        })
      : new Response('unexpected', { status: 500 })) as unknown as typeof fetch;
  await expect(new MoccoPostReader(config(twice)).listPublished()).rejects.toThrow(/같은 legacyId/);
});

test('동시에 들어온 요청은 진행 중인 읽기 하나를 같이 기다린다', async () => {
  const one = fakeMocco();
  await new MoccoPostReader(config(one.fetchFn)).listPublished();
  const callsForOneRead = one.calls.length;

  const many = fakeMocco();
  const reader = new MoccoPostReader(config(many.fetchFn));
  const results = await Promise.all([reader.listPublished(), reader.listPublished(), reader.listPublished()]);
  expect(many.calls.length).toBe(callsForOneRead);
  expect(results[1]).toBe(results[0]);

  // 실패한 읽기는 다음 요청이 다시 시도한다.
  const bad = fakeMocco({ failPath: /limit=/ });
  const failing = new MoccoPostReader(config(bad.fetchFn));
  await Promise.all([
    expect(failing.listPublished()).rejects.toBeInstanceOf(MoccoReadError),
    expect(failing.listPublished()).rejects.toBeInstanceOf(MoccoReadError),
  ]);
  expect(bad.calls.length).toBe(1);
  await expect(failing.listPublished()).rejects.toBeInstanceOf(MoccoReadError);
  expect(bad.calls.length).toBe(2);
});

test('타임아웃은 오류다', async () => {
  const hang = (async (_url: string, init: RequestInit) =>
    new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })) as unknown as typeof fetch;
  await expect(new MoccoPostReader(config(hang, { timeoutMs: 50 })).listPublished()).rejects.toBeInstanceOf(
    MoccoReadError,
  );
});

test('성공만 캐시하고, 실패는 캐시하지 않는다', async () => {
  let now = 0;
  const ok = fakeMocco();
  const reader = new MoccoPostReader(config(ok.fetchFn, { now: () => now, cacheMs: 1_000 }));
  await reader.listPublished();
  const callsAfterFirst = ok.calls.length;
  now = 500;
  await reader.listPublished();
  expect(ok.calls.length).toBe(callsAfterFirst);
  now = 2_000;
  await reader.listPublished();
  expect(ok.calls.length).toBeGreaterThan(callsAfterFirst);

  const bad = fakeMocco({ failPath: /limit=/ });
  const failing = new MoccoPostReader(config(bad.fetchFn));
  await expect(failing.listPublished()).rejects.toBeInstanceOf(MoccoReadError);
  await expect(failing.listPublished()).rejects.toBeInstanceOf(MoccoReadError);
  expect(bad.calls.length).toBe(2);
});

test('shadow 는 응답을 바꾸지 않는다: 실패해도, 달라도 파일 결과를 돌려주고 로그만 남긴다', async () => {
  const logs: string[] = [];
  const file = new FilePostReader();
  const expected = getAllPosts();

  const failing = new ShadowPostReader(file, { listPublished: async () => Promise.reject(new Error('down')) }, l =>
    logs.push(l),
  );
  expect(await failing.listPublished()).toEqual(expected);

  const different = new ShadowPostReader(
    file,
    { listPublished: async () => expected.slice(1).map(p => (p.uuid === '2' ? { ...p, title: 'x' } : p)) },
    l => logs.push(l),
  );
  expect(await different.listPublished()).toEqual(expected);
  expect(logs[0]).toContain('shadow read failed');
  expect(logs[1]).toMatch(/missing=1.*changed=1\(2:title\)/);
});

test('원천 선택: 기본은 파일, 잘못된 값과 키 없는 모코 원천은 시작부터 거부한다', () => {
  expect(postReaderFromEnv({} as NodeJS.ProcessEnv)).toBeInstanceOf(FilePostReader);
  expect(() => postReaderFromEnv({ POSTS_SOURCE: 'db' } as unknown as NodeJS.ProcessEnv)).toThrow();
  expect(() => postReaderFromEnv({ POSTS_SOURCE: 'mocco' } as unknown as NodeJS.ProcessEnv)).toThrow(
    /MOCCO_BLOG_READ_KEY/,
  );
  expect(() => postReaderFromEnv({ POSTS_SHADOW: 'mocco' } as unknown as NodeJS.ProcessEnv)).toThrow(
    /MOCCO_BLOG_READ_KEY/,
  );
  expect(
    postReaderFromEnv({
      POSTS_SHADOW: 'mocco',
      MOCCO_API_URL: 'https://m',
      MOCCO_BLOG_READ_KEY: 'k',
    } as unknown as NodeJS.ProcessEnv),
  ).toBeInstanceOf(ShadowPostReader);
});

test('제목이 바뀌어도 url 은 모코의 고정 permalink 다', async () => {
  const { fetchFn } = fakeMocco({
    details: d =>
      d.legacyId === '3' ? { ...d, frontmatter: d.frontmatter!.replace(/^title: '.*'$/m, "title: '새 제목'") } : d,
  });
  const posts = await new MoccoPostReader(config(fetchFn)).listPublished();
  const original = getAllPosts().find(p => p.uuid === '3')!;
  const changed = posts.find(p => p.uuid === '3')!;
  expect(changed.title).toBe('새 제목');
  expect(changed.url).toBe(original.url);
});

test('모코의 디코딩된 permalink 를 기존과 같은 인코딩 주소로 만든다', () => {
  getAllPosts().forEach(p => {
    expect(hrefOfPermalink(decodeURIComponent(p.url))).toBe(p.url);
  });
  expect(hrefOfPermalink('/posts/1-100% 확률/반반')).toBe(getPostUrl('1', '100% 확률/반반'));
});
