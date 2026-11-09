/**
 * 모코 /v1 blog 읽기 API → 기존 Post 모양(W3, #8). 서버 전용: read key 를 다룬다.
 *
 * 기대하는 응답(모코 계약 spec "Public read surface", fi-workers/mocco#819 이 구현):
 *   GET {base}/v1/blog/posts?cursor=&limit=  → { items: MoccoPostSummary[], nextCursor: string | null }
 *   GET {base}/v1/blog/posts/{id}            → MoccoPostDetail
 *
 * 규칙
 * - 공개본만 받는다. 응답에 공개가 아닌 글이 섞여 있으면 거부한다(fail closed).
 * - 이관된 글은 원문 frontmatter + 본문을 파일 원천과 같은 함수(postFromMarkdown)로 읽어 DTO 를 같게 만든다.
 * - 주소(url)는 모코의 고정 permalink 를 쓴다. 제목에서 다시 만들지 않는다(W4 #9).
 *   모코는 permalink 를 디코딩된 경로로 준다. `/posts/` 뒤를 encodeURIComponent 로 인코딩해 href 를 만든다.
 *   기존 주소는 `/posts/{id}-{encodeURIComponent(제목)}` 이었으므로 같은 문자열이 나온다.
 * - legacyId 가 없는 새 글은 단축 주소·bare ID 규칙이 아직 없다. 조용히 빼지 않고 오류로 알린다.
 * - 타임아웃·HTTP 오류·페이지 중간 실패·형식이 틀린 응답(mocco-wire)은 전체 실패다. 부분 결과를 돌려주지 않는다.
 * - 목록과 상세가 서로 맞지 않거나(id·legacyId), 같은 legacyId 가 두 번 나오면 거부한다.
 * - 동시에 들어온 요청은 진행 중인 읽기 하나를 같이 기다린다(캐시가 비었을 때 모코에 같은 요청이 몰리지 않게).
 * - 성공한 목록만 짧게 캐시한다. 실패나 빈 응답을 "글이 삭제됨"으로 캐시하지 않는다.
 */
import type { z } from 'zod';
import type { Post } from '@/repository/post-types';
import { postFromMarkdown, sortPostsForList } from '@/repository/post-markdown';
import { MoccoReadError } from '@/server/mocco-read-error';
import {
  type MoccoPostDetail,
  type MoccoPostSummary,
  moccoPostDetailSchema,
  moccoPostListSchema,
  parseWire,
} from '@/server/mocco-wire';

export { MoccoReadError } from '@/server/mocco-read-error';

export type { MoccoPostDetail, MoccoPostSummary } from '@/server/mocco-wire';

const POSTS_PREFIX = '/posts/';

/** 모코의 디코딩된 permalink → 인코딩된 href. `/posts/` 뒤 전체를 한 덩어리로 인코딩한다. */
export function hrefOfPermalink(permalink: string): string {
  return `${POSTS_PREFIX}${encodeURIComponent(permalink.slice(POSTS_PREFIX.length))}`;
}

export type MoccoConfig = {
  baseUrl: string;
  readKey: string;
  timeoutMs: number;
  cacheMs: number;
  pageSize: number;
  concurrency: number;
  fetch?: typeof fetch;
  now?: () => number;
};

export function moccoConfigFromEnv(env: NodeJS.ProcessEnv): MoccoConfig {
  const baseUrl = env.MOCCO_API_URL;
  const readKey = env.MOCCO_BLOG_READ_KEY;
  if (!baseUrl || !readKey) {
    throw new Error('모코 원천에는 MOCCO_API_URL 과 MOCCO_BLOG_READ_KEY 가 필요하다');
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    readKey,
    timeoutMs: Number(env.MOCCO_TIMEOUT_MS ?? 10_000),
    cacheMs: Number(env.MOCCO_CACHE_MS ?? 60_000),
    pageSize: 100,
    concurrency: 8,
  };
}

export class MoccoPostReader {
  private cache?: { at: number; posts: Post[] };

  private inflight?: Promise<Post[]>;

  constructor(private readonly config: MoccoConfig) {}

  private now() {
    return this.config.now?.() ?? Date.now();
  }

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const doFetch = this.config.fetch ?? fetch;
    let res: Response;
    try {
      res = await doFetch(`${this.config.baseUrl}${path}`, {
        headers: { authorization: `Bearer ${this.config.readKey}`, accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (e) {
      throw new MoccoReadError(`${path} 요청 실패: ${(e as Error).name}`);
    }
    if (!res.ok) {
      throw new MoccoReadError(`${path} → HTTP ${res.status}`);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new MoccoReadError(`${path} 응답이 JSON 이 아니다`);
    }
    return parseWire(schema, body, path);
  }

  private async listSummaries(): Promise<MoccoPostSummary[]> {
    const items: MoccoPostSummary[] = [];
    let cursor: string | null = null;
    do {
      const query: string = `?limit=${this.config.pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      // eslint-disable-next-line no-await-in-loop -- 커서는 앞 페이지 응답에서만 나온다
      const page = await this.get(`/v1/blog/posts${query}`, moccoPostListSchema);
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return items;
  }

  private async details(ids: string[]): Promise<MoccoPostDetail[]> {
    const out = new Array<MoccoPostDetail>(ids.length);
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const i = next;
        next += 1;
        // eslint-disable-next-line no-await-in-loop -- 동시 요청 수를 config.concurrency 로 묶는다
        const detail = await this.get(`/v1/blog/posts/${encodeURIComponent(ids[i]!)}`, moccoPostDetailSchema);
        if (detail.id !== ids[i]) {
          throw new MoccoReadError(`상세 응답의 id 가 요청과 다르다: ${ids[i]} → ${detail.id}`);
        }
        out[i] = detail;
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.config.concurrency, ids.length) }, worker));
    return out;
  }

  async listPublished(): Promise<Post[]> {
    if (this.cache && this.now() - this.cache.at < this.config.cacheMs) {
      return this.cache.posts;
    }
    this.inflight ??= this.read().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  private async read(): Promise<Post[]> {
    const summaries = await this.listSummaries();
    const notPublic = summaries.filter(s => s.status !== 'public');
    if (notPublic.length) {
      throw new MoccoReadError(`공개가 아닌 글이 응답에 있다: ${notPublic.map(s => s.id).join(',')}`);
    }
    const withoutLegacy = summaries.filter(s => !s.legacyId);
    if (withoutLegacy.length) {
      throw new MoccoReadError(
        `legacyId 없는 글의 주소 규칙이 아직 없다(W4 #9): ${withoutLegacy.map(s => s.id).join(',')}`,
      );
    }

    const legacyIds = summaries.map(s => s.legacyId!);
    const duplicated = legacyIds.filter((id, i) => legacyIds.indexOf(id) !== i);
    if (duplicated.length) {
      throw new MoccoReadError(`같은 legacyId 가 여러 글에 있다: ${Array.from(new Set(duplicated)).join(',')}`);
    }

    const details = await this.details(summaries.map(s => s.id));
    const posts = details.map((d, i) => {
      if (d.legacyId !== summaries[i]!.legacyId) {
        throw new MoccoReadError(`목록과 상세의 legacyId 가 다르다: ${d.id}`);
      }
      if (d.status !== 'public') {
        throw new MoccoReadError(`공개가 아닌 글: ${d.id}`);
      }
      if (d.frontmatter == null) {
        throw new MoccoReadError(`frontmatter 없는 글은 아직 지원하지 않는다: ${d.id}`);
      }
      if (!d.permalink.startsWith(POSTS_PREFIX)) {
        throw new MoccoReadError(`글 permalink 형식이 아니다 ${d.id}: ${d.permalink}`);
      }
      // 주소는 모코가 고정한 permalink 다(W4 #9). 제목이 바뀌어도 처음 공개된 주소를 유지한다.
      return { ...postFromMarkdown(d.legacyId!, `${d.frontmatter}${d.bodyMd}`), url: hrefOfPermalink(d.permalink) };
    });

    const sorted = sortPostsForList(posts);
    if (sorted.length) {
      this.cache = { at: this.now(), posts: sorted };
    }
    return sorted;
  }
}
