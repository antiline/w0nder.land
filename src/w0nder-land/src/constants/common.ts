export enum Environment {
  Local = 'local',
  Production = 'production',
}

export const PROFILE = {
  id: 'w0nder',
  name: 'w0nder',
  bio: '개발합니다. 만듭니다.',
  description:
    '10년 넘게 콘텐츠, 모빌리티, 이커머스, 메디컬, AI 스타트업에서 기민하고 응집력 있게 일해왔습니다.\n다양한 포지션에서 개발과 매니징을 해왔고, 최근 4년간은 CTO로 일하고 있습니다.\n경험을 나누고자 클라우드 보안 도서를 집필했고, 대학 강의와 주니어 개발자 커리어 상담을 하고 있습니다.\n또한 개발자 커뮤니티에서 다양한 스터디와 독서모임을 운영하며 함께 성장하는 문화를 만들어가고 있습니다.',
  profileImageUrl: '/images/profile_image.png',
  email: 'alice@w0nder.land',
};

export const SOCIALS = [
  {
    type: 'email',
    username: 'alice@w0nder.land',
    icon: 'ri-mail-line',
    url: 'mailto:alice@w0nder.land',
    bg: 'bg-[#FFB2EF] text-black',
  },
  {
    type: 'twitter',
    username: 'w0nder_official',
    icon: 'ri-twitter-x-fill',
    url: 'https://x.com/w0nder_official',
    bg: 'bg-[#1DA1F2] text-white',
  },
  {
    type: 'github',
    username: 'w0nder_official',
    icon: 'ri-github-fill',
    url: 'https://github.com/w0nder_official',
    bg: 'bg-[#24292F] text-white',
  },
  {
    type: 'threads',
    username: 'w0nder_official',
    icon: 'ri-threads-fill',
    url: 'https://threads.net/w0nder_official',
    bg: 'bg-[#C4A1FF] text-black',
  },
];

export const LINKS = [
  {
    id: 5,
    key: 'blog',
    title: 'Blog',
    icon: 'ri-book-open-line',
    url: '/posts',
    bg: 'bg-pink-400',
  },
  {
    id: 1,
    key: 'show-your-time',
    title: 'Show Your Time',
    icon: 'ri-camera-fill',
    url: 'https://showyourti.me/qr',
    target: '_blank',
    bg: 'bg-lime-400',
    description: '세상에서 제일 예쁜 타임스탬프 앱',
  },
  {
    id: 2,
    key: 'checkable',
    title: 'Checkable',
    icon: 'ri-check-fill',
    url: 'https://checkable.app',
    target: '_blank',
    bg: 'bg-purple-400',
    description: '디스코드로 챌린지를 관리해 보세요.',
  },
  {
    id: 3,
    key: 'fi-workers',
    title: 'fi-workers',
    icon: 'ri-building-line',
    url: 'https://fi-workers.com/about',
    target: '_blank',
    bg: 'bg-teal-400',
  },
  {
    id: 4,
    key: 'coffee-chat',
    title: 'Coffee Chat',
    icon: 'ri-cup-fill',
    url: 'https://www.latpeed.com/products/rSNlW',
    target: '_blank',
    bg: 'bg-yellow-400',
    description: '커리어/상담',
  },
];
