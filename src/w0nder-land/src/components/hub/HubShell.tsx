import type { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export const hubControlClass =
  'min-h-12 border-2 border-black px-4 py-3 bg-white text-black focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-blue-700';

export function HubShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div lang="ko" className="min-h-screen bg-gray-100 text-black">
      <Head>
        <title>{title} | w0nder.land</title>
        <meta name="description" content={description} />
        <meta name="robots" content="noindex,follow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <a href="#hub-content" className="sr-only focus:not-sr-only focus:block focus:p-4">
        본문으로 건너뛰기
      </a>
      <header className="border-b-4 border-black bg-white p-4 md:p-6">
        <nav aria-label="사이트 이동" className="mx-auto flex max-w-6xl flex-wrap gap-4">
          <Link href="/" className={`${hubControlClass} font-black`}>
            ← HOME
          </Link>
          <Link href="/posts" className={`${hubControlClass} font-black`}>
            POSTS
          </Link>
        </nav>
      </header>
      <main id="hub-content" className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <h1 className="mb-4 break-words text-4xl font-black md:text-5xl">{title}</h1>
        <p className="mb-10 max-w-2xl leading-7 text-gray-700">{description}</p>
        {children}
      </main>
    </div>
  );
}
