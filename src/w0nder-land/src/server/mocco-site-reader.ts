/**
 * 모코 /v1/blog/site → 홈 프로필(W5, #10). 서버 전용: read key 를 다룬다.
 *
 * 기대하는 응답(모코 계약 spec "Public read surface"):
 *   GET {base}/v1/blog/site → { name, description, links: MoccoLink[], authors: [{ displayName, bio, avatar, links }] }
 *
 * 대응: 사이트 이름 → name, 사이트 description → 긴 소개, 첫 작가의 bio → 한 줄 소개, 첫 작가의 avatar → 프로필 이미지.
 * 사이트 links 중 kind=social 은 아이콘 줄, 나머지는 버튼 목록. 순서는 배열 순서다.
 *
 * 규칙: 공개 필드만 쓴다. 형식이 틀린 응답은 거부한다(mocco-wire). 작가가 없거나, 이미지가 없거나, 허용하지 않는 주소(`safeHref`)가 하나라도 있으면
 * 전체를 거부한다(fail closed). 일부만 조용히 빼서 화면을 바꾸지 않는다. ISR 은 실패하면 이전 페이지를 유지한다.
 */
import { safeHref } from '@/libs/site/safe-href';
import type { ProfileLink, SiteProfile } from '@/repository/site-profile-types';
import type { MoccoConfig } from '@/server/mocco-post-reader';
import { MoccoReadError } from '@/server/mocco-read-error';
import { type MoccoLink, type MoccoSite, moccoSiteSchema, parseWire } from '@/server/mocco-wire';

export type { MoccoLink, MoccoSite } from '@/server/mocco-wire';

function profileLinkOf(link: MoccoLink): ProfileLink {
  const url = safeHref(link.url);
  if (url === null) {
    throw new MoccoReadError(`허용하지 않는 링크 주소: ${link.label}`);
  }
  return { key: link.key ?? null, label: link.label, url, description: link.description ?? '' };
}

/** 응답 → 프로필. 순수 함수라 테스트에서 바로 쓴다. */
export function siteProfileOf(site: MoccoSite): SiteProfile {
  const author = site.authors[0];
  if (!author) {
    throw new MoccoReadError('사이트에 작가가 없다');
  }
  if (!author.avatar) {
    throw new MoccoReadError('작가 프로필 이미지가 없다');
  }
  const socials = site.links.filter(l => l.kind === 'social').map(profileLinkOf);
  const links = site.links.filter(l => l.kind !== 'social').map(profileLinkOf);
  const mail = socials.find(l => l.url.startsWith('mailto:'));
  return {
    name: site.name,
    bio: author.bio,
    description: site.description,
    image: author.avatar,
    email: mail ? mail.url.slice('mailto:'.length) : null,
    socials,
    links,
  };
}

export async function readMoccoSiteProfile(config: MoccoConfig): Promise<SiteProfile> {
  const doFetch = config.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${config.baseUrl}/v1/blog/site`, {
      headers: { authorization: `Bearer ${config.readKey}`, accept: 'application/json' },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (e) {
    throw new MoccoReadError(`/v1/blog/site 요청 실패: ${(e as Error).name}`);
  }
  if (!res.ok) {
    throw new MoccoReadError(`/v1/blog/site → HTTP ${res.status}`);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new MoccoReadError('/v1/blog/site 응답이 JSON 이 아니다');
  }
  return siteProfileOf(parseWire(moccoSiteSchema, body, '/v1/blog/site'));
}
