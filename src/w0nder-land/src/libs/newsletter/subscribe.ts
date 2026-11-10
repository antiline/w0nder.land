import { z } from 'zod';

export type NewsletterConfig = { endpoint: string; publishableKey: string };

const accepted = z.object({ status: z.literal('pending_confirmation') });

/** 재시도는 하지 않는다. 응답이 유실되어도 확인 메일이 이미 요청됐을 수 있다. */
export async function requestSubscription(
  config: NewsletterConfig,
  input: { email: string; website: string },
  transport: typeof fetch = fetch,
): Promise<void> {
  const response = await transport(config.endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.publishableKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, scope: 'site', locale: 'ko' }),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status !== 202 || !accepted.safeParse(await response.json()).success) {
    throw new Error('구독 요청을 확인할 수 없다');
  }
}
