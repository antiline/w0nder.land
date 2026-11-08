/**
 * 홈 링크의 모양(W5, #10). 원천은 `key` 만 주고, 아이콘·색은 여기서 정한다.
 * 기존 상수(`SOCIALS`·`LINKS`)의 모양을 그대로 옮겼다. 모르는 key 는 기본 모양.
 */
import { LINKS, SOCIALS } from '@/constants/common';

export type LinkStyle = { icon: string; bg: string };

const SOCIAL_STYLES: Record<string, LinkStyle> = Object.fromEntries(
  SOCIALS.map(s => [s.type, { icon: s.icon, bg: s.bg }]),
);
const LINK_STYLES: Record<string, LinkStyle> = Object.fromEntries(LINKS.map(l => [l.key, { icon: l.icon, bg: l.bg }]));

export const DEFAULT_SOCIAL_STYLE: LinkStyle = { icon: 'ri-link', bg: 'bg-white text-black' };
export const DEFAULT_LINK_STYLE: LinkStyle = { icon: 'ri-link', bg: 'bg-white' };

export const socialStyleOf = (key: string | null): LinkStyle =>
  (key !== null && SOCIAL_STYLES[key]) || DEFAULT_SOCIAL_STYLE;
export const linkStyleOf = (key: string | null): LinkStyle => (key !== null && LINK_STYLES[key]) || DEFAULT_LINK_STYLE;
