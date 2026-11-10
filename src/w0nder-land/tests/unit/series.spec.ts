import { expect, test } from '@playwright/test';
import { readSeriesList, readSeries } from '@/server/mocco-series-reader';

const id = 'f6885bc7-0b48-446e-8c5b-c78499ba5c47';
const summary = { id, title: '연재', slug: 'series', status: 'ongoing', postCount: 1 };
const config = { baseUrl: 'https://mocco.test', readKey: 'mk_sec_test', timeoutMs: 1000 };

test('연재 목록은 끝 커서까지 읽고 서버 키만 사용한다', async () => {
  const requests: string[] = [];
  const transport: typeof fetch = async (input, init) => {
    requests.push(String(input));
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer mk_sec_test');
    const cursor = new URL(String(input)).searchParams.get('cursor');
    return Response.json(cursor ? { items: [], nextCursor: null } : { items: [summary], nextCursor: id });
  };
  expect(await readSeriesList({ ...config, fetch: transport })).toEqual([summary]);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toContain(`cursor=${id}`);
});

test('연재 상세는 기존 고정 주소로 연결하며 초안·형식 오류·반복 커서를 거부한다', async () => {
  const post = { id, title: '글 제목', permalink: '/posts/예전 제목', status: 'public' };
  const transport: typeof fetch = async () => Response.json({ ...summary, posts: [post] });
  expect(await readSeries(id, { ...config, fetch: transport })).toMatchObject({
    title: '연재',
    posts: [{ title: '글 제목', url: '/posts/%EC%98%88%EC%A0%84%20%EC%A0%9C%EB%AA%A9' }],
  });
  await expect(
    readSeries(id, {
      ...config,
      fetch: async () => Response.json({ ...summary, posts: [{ ...post, status: 'draft' }] }),
    }),
  ).rejects.toThrow();
  expect(await readSeries(id, { ...config, fetch: async () => new Response('', { status: 404 }) })).toBeNull();
  await expect(
    readSeriesList({ ...config, fetch: async () => Response.json({ items: [], nextCursor: id }) }),
  ).rejects.toThrow(/커서/);
  await expect(readSeriesList({ ...config, fetch: async () => new Response('', { status: 503 }) })).rejects.toThrow();
});
