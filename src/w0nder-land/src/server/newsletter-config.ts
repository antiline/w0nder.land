import type { NewsletterConfig } from '@/libs/newsletter/subscribe';

/** 서버에서만 읽고, 구독 전용 publishable key만 공개 props에 넘긴다. */
export function newsletterConfigFromEnv(env: Record<string, string | undefined>): NewsletterConfig | null {
  if (env.NEWSLETTER_ENABLED !== 'true') {
    return null;
  }
  const key = env.MOCCO_NEWSLETTER_KEY;
  if (!key || !/^mk_pub_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error('구독 화면에는 newsletter:subscribe 범위의 publishable key가 필요하다');
  }
  const base = new URL(env.MOCCO_API_URL ?? '');
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    throw new Error('구독 API 주소는 인증정보·쿼리 없는 HTTPS 주소여야 한다');
  }
  return { endpoint: `${base.href.replace(/\/$/, '')}/v1/newsletter/subscribers`, publishableKey: key };
}
