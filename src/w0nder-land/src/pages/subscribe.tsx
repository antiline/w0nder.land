import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { HubShell, hubControlClass } from '@/components/hub/HubShell';
import { requestSubscription } from '@/libs/newsletter/subscribe';
import type { NewsletterConfig } from '@/libs/newsletter/subscribe';
import { newsletterConfigFromEnv } from '@/server/newsletter-config';

type SubscribeProps = { config: NewsletterConfig };

export default function SubscribePage({ config }: SubscribeProps) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'accepted' | 'error'>('idle');
  const submitting = useRef(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) {
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    submitting.current = true;
    setStatus('pending');
    try {
      await requestSubscription(config, {
        email: String(data.get('email') ?? '').trim(),
        website: String(data.get('website') ?? ''),
      });
      form.reset();
      setStatus('accepted');
    } catch {
      setStatus('error');
    } finally {
      submitting.current = false;
    }
  };
  return (
    <HubShell
      title="새 글 받아보기"
      description="새 글을 이메일로 받아보세요. 확인 메일의 링크를 눌러야 구독이 시작됩니다.">
      <section className="max-w-xl border-4 border-black bg-white p-6 shadow-[4px_4px_0_0_#000]">
        <noscript>
          <p className="mb-4">구독 요청에는 자바스크립트가 필요합니다. 브라우저 설정에서 켠 뒤 다시 시도해 주세요.</p>
        </noscript>
        {status === 'accepted' ? (
          <div role="status" aria-live="polite">
            <h2 className="mb-3 text-2xl font-black">메일함을 확인해 주세요</h2>
            <p className="leading-7">
              요청을 받았습니다. 확인이 필요한 경우 확인 메일이 도착합니다. 이미 구독 중인 주소에는 새 확인 메일이 오지
              않을 수 있습니다.
            </p>
          </div>
        ) : (
          <form
            method="post"
            action="/subscribe"
            onSubmit={submit}
            className="grid gap-4"
            aria-busy={status === 'pending'}>
            <label htmlFor="subscriber-email" className="grid gap-3 font-bold">
              이메일 주소
              <input
                id="subscriber-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                aria-describedby="subscribe-help subscribe-result"
                className={`${hubControlClass} w-full min-w-0`}
              />
            </label>
            <div hidden aria-hidden="true">
              <label htmlFor="subscriber-website">
                웹사이트 (비워 두세요)
                <input id="subscriber-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <p id="subscribe-help" className="text-sm leading-6 text-gray-600">
              이메일 주소는 새 글 알림과 구독 관리에 사용합니다. 언제든 메일의 구독 해지 링크에서 해당 알림 또는 모든
              알림을 중단할 수 있습니다.
            </p>
            <button
              type="submit"
              disabled={status === 'pending'}
              className={`${hubControlClass} bg-yellow-300 font-black disabled:cursor-wait disabled:opacity-60`}>
              {status === 'pending' ? '요청 중…' : '확인 메일 받기'}
            </button>
            <p
              id="subscribe-result"
              role={status === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className="leading-7">
              {status === 'error'
                ? '요청 결과를 확인하지 못했습니다. 메일함을 먼저 확인하고 잠시 후 다시 시도해 주세요.'
                : ''}
            </p>
          </form>
        )}
      </section>
    </HubShell>
  );
}

export const getServerSideProps: GetServerSideProps<SubscribeProps> = async ({ res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const config = newsletterConfigFromEnv(process.env);
  return config ? { props: { config } } : { notFound: true };
};
