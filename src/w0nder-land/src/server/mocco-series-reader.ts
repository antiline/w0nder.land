import { z } from 'zod';
import { hrefOfPermalink } from '@/server/mocco-post-reader';
import type { MoccoConfig } from '@/server/mocco-post-reader';
import { MoccoReadError } from '@/server/mocco-read-error';
import { parseWire } from '@/server/mocco-wire';

const summarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  status: z.enum(['ongoing', 'finished']),
  postCount: z.number().int().positive(),
});
const listSchema = z.object({ items: z.array(summarySchema), nextCursor: z.string().uuid().nullable() });
const detailSchema = summarySchema.extend({
  posts: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      status: z.literal('public'),
      permalink: z.string().refine(path => path.startsWith('/posts/') && path.length > '/posts/'.length),
    }),
  ),
});

export type HubSeriesSummary = z.infer<typeof summarySchema>;
export type HubSeriesDetail = Omit<z.infer<typeof detailSchema>, 'posts'> & {
  posts: (z.infer<typeof detailSchema>['posts'][number] & { url: string })[];
};
type Config = Pick<MoccoConfig, 'baseUrl' | 'readKey' | 'timeoutMs' | 'fetch'>;

async function get(path: string, config: Config): Promise<unknown | null> {
  try {
    const response = await (config.fetch ?? fetch)(`${config.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${config.readKey}`, accept: 'application/json' },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new MoccoReadError(`연재 API → HTTP ${response.status}`);
    }
    return await response.json();
  } catch {
    throw new MoccoReadError('연재 API를 읽지 못했다');
  }
}

/** 서버 전용. 공개 시리즈의 모든 페이지를 읽으며 부분 결과는 반환하지 않는다. */
export async function readSeriesList(config: Config): Promise<HubSeriesSummary[]> {
  const items: HubSeriesSummary[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    // eslint-disable-next-line no-await-in-loop -- 다음 커서는 이전 응답에서 나온다
    const raw = await get(`/v1/blog/series?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, config);
    const page = parseWire(listSchema, raw, '연재 목록');
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor && cursors.has(cursor)) {
      throw new MoccoReadError('연재 목록 커서가 반복된다');
    }
    if (cursor) {
      cursors.add(cursor);
    }
  } while (cursor);
  return items;
}

export async function readSeries(id: string, config: Config): Promise<HubSeriesDetail | null> {
  const raw = await get(`/v1/blog/series/${encodeURIComponent(id)}`, config);
  if (raw === null) {
    return null;
  }
  const detail = parseWire(detailSchema, raw, '연재 상세');
  if (detail.id !== id || detail.posts.length !== detail.postCount) {
    throw new MoccoReadError('연재 상세의 ID 또는 글 개수가 맞지 않는다');
  }
  return { ...detail, posts: detail.posts.map(post => ({ ...post, url: hrefOfPermalink(post.permalink) })) };
}
