/**
 * 홈 프로필을 읽는 경계(W5, #10). getStaticProps 에서만 import 한다(서버 전용 값을 다룬다).
 *
 * - SITE_PROFILE_SOURCE=file (기본): 저장소 상수. 지금 운영과 같다.
 * - SITE_PROFILE_SOURCE=mocco: 모코 /v1/blog/site. 실패하면 오류를 던진다. 상수로 몰래 대체하지 않는다.
 */
import { fileSiteProfile } from '@/repository/site-profile-file';
import type { SiteProfile } from '@/repository/site-profile-types';
import { moccoConfigFromEnv } from '@/server/mocco-post-reader';
import { readMoccoSiteProfile } from '@/server/mocco-site-reader';

export type SiteProfileSource = 'file' | 'mocco';

export function siteProfileSourceFromEnv(env: NodeJS.ProcessEnv = process.env): SiteProfileSource {
  const source = env.SITE_PROFILE_SOURCE ?? 'file';
  if (source !== 'file' && source !== 'mocco') {
    throw new Error(`SITE_PROFILE_SOURCE 값이 잘못됐다: ${source}`);
  }
  return source;
}

export async function readSiteProfile(env: NodeJS.ProcessEnv = process.env): Promise<SiteProfile> {
  return siteProfileSourceFromEnv(env) === 'mocco' ? readMoccoSiteProfile(moccoConfigFromEnv(env)) : fileSiteProfile();
}
