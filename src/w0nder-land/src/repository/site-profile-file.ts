import { LINKS, PROFILE, SOCIALS } from '@/constants/common';
import type { SiteProfile } from '@/repository/site-profile-types';

/** 저장소 상수의 프로필(W5 기본 원천). 지금 운영 화면과 같다. */
export function fileSiteProfile(): SiteProfile {
  return {
    name: PROFILE.name,
    bio: PROFILE.bio,
    description: PROFILE.description,
    image: PROFILE.profileImageUrl,
    email: PROFILE.email,
    socials: SOCIALS.map(s => ({ key: s.type, label: s.type, url: s.url, description: '' })),
    links: LINKS.map(l => ({ key: l.key, label: l.title, url: l.url, description: l.description ?? '' })),
  };
}
