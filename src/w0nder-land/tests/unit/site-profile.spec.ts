/* eslint-disable no-script-url -- 막아야 할 주소를 입력으로 검사한다 */
import { expect, test } from '@playwright/test';
import { LINKS, PROFILE, SOCIALS } from '@/constants/common';
import { DEFAULT_LINK_STYLE, linkStyleOf, socialStyleOf } from '@/libs/site/link-style';
import { safeHref } from '@/libs/site/safe-href';
import { fileSiteProfile } from '@/repository/site-profile-file';
import { MoccoSite, readMoccoSiteProfile, siteProfileOf } from '@/server/mocco-site-reader';
import { MoccoReadError } from '@/server/mocco-read-error';
import { readSiteProfile, siteProfileSourceFromEnv } from '@/server/site-profile-reader';

/** 지금 상수를 모코 /v1/blog/site 응답 모양으로 옮긴 것. 같은 화면이 나와야 한다. */
const sameAsConstants: MoccoSite = {
  name: PROFILE.name,
  description: PROFILE.description,
  links: [
    ...SOCIALS.map(s => ({ key: s.type, kind: 'social' as const, label: s.type, url: s.url })),
    ...LINKS.map(l => ({ key: l.key, kind: 'link' as const, label: l.title, url: l.url, description: l.description })),
  ],
  authors: [{ displayName: PROFILE.name, bio: PROFILE.bio, avatar: PROFILE.profileImageUrl, links: [] }],
};

test('기본 원천은 지금 상수와 같은 프로필이다', async () => {
  expect(siteProfileSourceFromEnv({} as NodeJS.ProcessEnv)).toBe('file');
  const profile = await readSiteProfile({} as NodeJS.ProcessEnv);
  expect(profile).toEqual(fileSiteProfile());
  expect(profile.links.map(l => l.label)).toEqual(LINKS.map(l => l.title));
  expect(profile.socials.map(s => s.url)).toEqual(SOCIALS.map(s => s.url));
  expect(profile.email).toBe(PROFILE.email);
});

test('상수와 같은 값을 주는 모코 응답은 기본 원천과 같은 프로필이 된다', () => {
  expect(siteProfileOf(sameAsConstants)).toEqual(fileSiteProfile());
});

test('모양은 key 로 고르고, 모르는 key·없는 key 는 기본 모양', () => {
  SOCIALS.forEach(s => expect(socialStyleOf(s.type)).toEqual({ icon: s.icon, bg: s.bg }));
  LINKS.forEach(l => expect(linkStyleOf(l.key)).toEqual({ icon: l.icon, bg: l.bg }));
  expect(linkStyleOf('unknown')).toEqual(DEFAULT_LINK_STYLE);
  expect(linkStyleOf(null)).toEqual(DEFAULT_LINK_STYLE);
});

test('링크 주소 출력 정책', () => {
  ['https://x.com/a', 'http://a.b', 'mailto:a@b.c', '/posts', '/s/abc'].forEach(u => expect(safeHref(u)).toBe(u));
  [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>1</script>',
    '//evil.com',
    '/\\evil.com',
    ' https://x.com',
    '',
    'ftp://a.b',
    'not a url',
  ].forEach(u => expect(safeHref(u)).toBeNull());
});

test('모코 응답에 허용하지 않는 주소·작가 없음·이미지 없음이 있으면 전체를 거부한다', () => {
  const bad = (patch: Partial<MoccoSite>) => () => siteProfileOf({ ...sameAsConstants, ...patch });
  expect(bad({ links: [{ label: 'x', url: 'javascript:alert(1)' }] })).toThrow(MoccoReadError);
  expect(bad({ authors: [] })).toThrow(MoccoReadError);
  expect(bad({ authors: [{ ...sameAsConstants.authors[0]!, avatar: null }] })).toThrow(MoccoReadError);
});

test('모코가 실패하면 오류를 던지고 상수로 대체하지 않는다', async () => {
  const config = {
    baseUrl: 'https://mocco.test',
    readKey: 'k',
    timeoutMs: 1000,
    cacheMs: 0,
    pageSize: 100,
    concurrency: 1,
  };
  const failing = (async () => new Response('x', { status: 503 })) as unknown as typeof fetch;
  await expect(readMoccoSiteProfile({ ...config, fetch: failing })).rejects.toThrow(MoccoReadError);
  const ok = (async (url: string) => {
    expect(url).toBe('https://mocco.test/v1/blog/site');
    return Response.json(sameAsConstants);
  }) as unknown as typeof fetch;
  expect(await readMoccoSiteProfile({ ...config, fetch: ok })).toEqual(fileSiteProfile());
  expect(() => siteProfileSourceFromEnv({ SITE_PROFILE_SOURCE: 'x' } as unknown as NodeJS.ProcessEnv)).toThrow();
});
