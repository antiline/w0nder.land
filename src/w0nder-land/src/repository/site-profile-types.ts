/**
 * 홈(소개) 화면이 보여 주는 프로필과 링크(W5, #10). 클라이언트에서도 쓰는 순수 타입이다.
 *
 * 데이터(이름·소개·링크 문구·URL·순서·설명)는 원천에서 오고, 모양(아이콘·색)은 원더랜드가 `key` 로 정한다.
 */
export type ProfileLink = {
  /** 모양을 고르는 안정 식별자. 원천이 주지 않으면 null 이고 기본 모양을 쓴다. */
  key: string | null;
  label: string;
  /** 검사를 통과한 주소만 들어온다(`safeHref`). */
  url: string;
  description: string;
};

export type SiteProfile = {
  name: string;
  /** 짧은 한 줄 소개 */
  bio: string;
  /** 긴 소개(줄바꿈 포함) */
  description: string;
  /** 프로필 이미지 경로 */
  image: string;
  /** structured data 의 email. mailto 소셜 링크에서 가져온다. */
  email: string | null;
  /** 아이콘 줄 */
  socials: ProfileLink[];
  /** 버튼 목록 */
  links: ProfileLink[];
};
