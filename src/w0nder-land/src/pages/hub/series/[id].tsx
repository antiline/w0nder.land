import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { HubShell } from '@/components/hub/HubShell';
import { readSeries } from '@/server/mocco-series-reader';
import type { HubSeriesDetail } from '@/server/mocco-series-reader';
import { moccoConfigFromEnv } from '@/server/mocco-post-reader';

type Props = { series: HubSeriesDetail };

export default function SeriesPage({ series }: Props) {
  return (
    <HubShell
      title={series.title}
      description={`${series.postCount}편 · ${series.status === 'finished' ? '완결' : '연재 중'}`}>
      <Link href="/hub" className="mb-8 inline-block underline underline-offset-4">
        ← 글 찾기
      </Link>
      <ol className="grid gap-5">
        {series.posts.map((post, index) => (
          <li key={post.id} className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]">
            <span className="mb-2 block text-sm text-gray-600">{index + 1}편</span>
            <h2 className="break-words text-xl font-bold">
              <Link href={post.url} className="underline underline-offset-4">
                {post.title}
              </Link>
            </h2>
          </li>
        ))}
      </ol>
    </HubShell>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ params, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const id = z.string().uuid().safeParse(params?.id);
  if (
    process.env.HUB_ENABLED !== 'true' ||
    process.env.HUB_SERIES_ENABLED !== 'true' ||
    process.env.POSTS_SOURCE !== 'mocco' ||
    !id.success
  ) {
    return { notFound: true };
  }
  const series = await readSeries(id.data, moccoConfigFromEnv(process.env));
  return series ? { props: { series } } : { notFound: true };
};
