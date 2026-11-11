/* eslint-disable no-script-url -- API 주소의 실행 스킴 거부를 검사한다 */
import { expect, test } from '@playwright/test';
import { discoverPosts } from '@/repository/hub-discovery';
import { FilePostReader } from '@/server/file-post-reader';
import { newsletterConfigFromEnv } from '@/server/newsletter-config';
import { requestSubscription } from '@/libs/newsletter/subscribe';

test('검색은 발행 목록의 제목·본문·태그를 유니코드 정규화해서 찾고 permalink를 유지한다', async () => {
  const posts = await new FilePostReader().listPublished();
  const one = { ...posts[0]!, title: '한글 SEARCH', article: '사과 본문', tags: ['태그'], category: '개발' };
  expect(discoverPosts([one], '한글'.normalize('NFD'), '').map(p => p.url)).toEqual([one.url]);
  expect(discoverPosts([one], 'search', '')).toEqual([one]);
  expect(discoverPosts([one], '사과', '')).toEqual([one]);
  expect(discoverPosts([one], '태그', '')).toEqual([one]);
  expect(discoverPosts([one], '', '다른 분류')).toEqual([]);
  expect(discoverPosts([one], '없는 검색어', '')).toEqual([]);
  expect(discoverPosts([one], '   ', '개발')).toEqual([one]);
});

test('구독은 기본 off, on이어도 secret key나 잘못된 endpoint를 공개하지 않는다', () => {
  expect(newsletterConfigFromEnv({})).toBeNull();
  expect(newsletterConfigFromEnv({ NEWSLETTER_ENABLED: 'false', MOCCO_NEWSLETTER_KEY: 'mk_sec_secret' })).toBeNull();
  const enabled = {
    NEWSLETTER_ENABLED: 'true',
    MOCCO_API_URL: 'https://mocco.test/api/ext',
    MOCCO_NEWSLETTER_KEY: 'mk_pub_test',
  };
  expect(newsletterConfigFromEnv(enabled)).toEqual({
    endpoint: 'https://mocco.test/api/ext/v1/newsletter/subscribers',
    publishableKey: 'mk_pub_test',
  });
  expect(() => newsletterConfigFromEnv({ ...enabled, MOCCO_NEWSLETTER_KEY: 'mk_sec_secret' })).toThrow();
  expect(() => newsletterConfigFromEnv({ ...enabled, MOCCO_API_URL: 'https://user:pass@mocco.test' })).toThrow();
  expect(() => newsletterConfigFromEnv({ ...enabled, MOCCO_API_URL: 'javascript:alert(1)' })).toThrow();
});

test('구독은 한 번만 요청하고 202 계약·오류·응답 유실을 구분한다', async () => {
  let calls = 0;
  const config = { endpoint: 'https://mocco.test/api/ext/v1/newsletter/subscribers', publishableKey: 'mk_pub_test' };
  const transport: typeof fetch = async (url, init) => {
    calls += 1;
    expect(url).toBe(config.endpoint);
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer mk_pub_test');
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'reader@example.test',
      locale: 'ko',
      scope: 'site',
      website: '',
    });
    return Response.json({ status: 'pending_confirmation' }, { status: 202 });
  };
  await expect(
    requestSubscription(config, { email: 'reader@example.test', website: '' }, transport),
  ).resolves.toBeUndefined();
  expect(calls).toBe(1);
  await expect(
    requestSubscription(
      config,
      { email: 'reader@example.test', website: '' },
      async () => new Response('', { status: 503 }),
    ),
  ).rejects.toThrow();
  await expect(
    requestSubscription(config, { email: 'reader@example.test', website: '' }, async () =>
      Response.json({ status: 'active' }, { status: 202 }),
    ),
  ).rejects.toThrow();
  await expect(
    requestSubscription(config, { email: 'reader@example.test', website: '' }, async () => {
      throw new Error('network');
    }),
  ).rejects.toThrow();
});
