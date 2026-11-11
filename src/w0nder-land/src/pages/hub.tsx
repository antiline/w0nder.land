import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { HubShell, hubControlClass } from '@/components/hub/HubShell';
import { discoverPosts } from '@/repository/hub-discovery';
import { postReader } from '@/server/post-reader';
import { moccoConfigFromEnv } from '@/server/mocco-post-reader';
import { readSeriesList } from '@/server/mocco-series-reader';
import type { HubSeriesSummary } from '@/server/mocco-series-reader';

type HubPost = { id: string; title: string; url: string; category: string; date: string };
type HubProps = {
  query: string;
  category: string;
  categories: string[];
  posts: HubPost[];
  series: HubSeriesSummary[];
  seriesEnabled: boolean;
};

export default function HubPage({ query, category, categories, posts, series, seriesEnabled }: HubProps) {
  return (
    <HubShell title="글 찾기" description="제목, 본문, 태그에서 글을 찾아보세요.">
      <form
        key={JSON.stringify([query, category])}
        action="/hub"
        method="get"
        role="search"
        className="mb-10 grid gap-4 border-4 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]">
        <label htmlFor="hub-query" className="grid gap-3 font-bold">
          검색어
          <input
            id="hub-query"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={200}
            className={hubControlClass}
          />
        </label>
        <label htmlFor="hub-category" className="grid gap-3 font-bold">
          카테고리
          <select id="hub-category" name="category" defaultValue={category} className={hubControlClass}>
            <option value="">모든 카테고리</option>
            {categories.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`${hubControlClass} bg-yellow-300 font-black`}>
          검색
        </button>
      </form>
      {seriesEnabled && (
        <section aria-labelledby="hub-series-title" className="mb-10 border-2 border-black bg-white p-5">
          <h2 id="hub-series-title" className="mb-4 text-2xl font-black">
            연재 모아보기
          </h2>
          {series.length === 0 ? (
            <p>공개된 연재가 아직 없습니다.</p>
          ) : (
            <ul className="grid gap-4">
              {series.map(item => (
                <li key={item.id}>
                  <Link href={`/hub/series/${item.id}`} className="break-words font-bold underline underline-offset-4">
                    {item.title}
                  </Link>
                  <span className="ml-2 text-sm text-gray-600">
                    {item.postCount}편 · {item.status === 'finished' ? '완결' : '연재 중'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="mb-6 font-bold" role="status">
        {posts.length}개의 글
      </p>
      {posts.length === 0 ? (
        <div className="border-2 border-black bg-white p-6">
          <h2 className="mb-3 text-xl font-bold">검색 결과가 없습니다</h2>
          <p className="mb-4">검색어를 줄이거나 다른 카테고리를 선택해 보세요.</p>
          <Link href="/hub" className="underline underline-offset-4">
            검색 초기화
          </Link>
        </div>
      ) : (
        <ul className="grid gap-5">
          {posts.map(post => (
            <li key={post.id} className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]">
              <p className="mb-3 text-sm text-gray-600">
                {post.category} · <time dateTime={post.date}>{post.date.slice(0, 10)}</time>
              </p>
              <h2 className="break-words text-xl font-bold">
                <Link href={post.url} className="underline-offset-4 hover:underline focus-visible:underline">
                  {post.title}
                </Link>
              </h2>
            </li>
          ))}
        </ul>
      )}
    </HubShell>
  );
}

export const getServerSideProps: GetServerSideProps<HubProps> = async ({ query, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (process.env.HUB_ENABLED !== 'true') {
    return { notFound: true };
  }
  const text = typeof query.q === 'string' ? query.q.slice(0, 200) : '';
  const category = typeof query.category === 'string' ? query.category.slice(0, 100) : '';
  const seriesEnabled = process.env.HUB_SERIES_ENABLED === 'true';
  const [all, series] = await Promise.all([
    postReader().listPublished(),
    seriesEnabled && process.env.POSTS_SOURCE === 'mocco'
      ? readSeriesList(moccoConfigFromEnv(process.env))
      : Promise.resolve([]),
  ]);
  return {
    props: {
      query: text,
      category,
      series,
      seriesEnabled,
      categories: Array.from(new Set(all.map(post => post.category).filter((value): value is string => !!value))),
      posts: discoverPosts(all, text, category).map(post => ({
        id: post.uuid,
        title: post.title,
        url: post.url,
        category: post.category ?? '',
        date: post.createdAt,
      })),
    },
  };
};
