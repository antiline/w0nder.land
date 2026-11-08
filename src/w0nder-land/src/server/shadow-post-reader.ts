import type { Post } from '@/repository/post-types';
import { comparePostLists, summarizeComparison } from '@/server/post-compare';
import type { PostReader } from '@/server/post-reader-port';

/** 응답은 primary 에서만 만든다. shadow 는 비교·로그에만 쓰고, 실패해도 응답에 영향을 주지 않는다. */
export class ShadowPostReader implements PostReader {
  constructor(
    private readonly primary: PostReader,
    private readonly shadow: PostReader,
    private readonly log: (line: string) => void = line => console.warn(line),
  ) {}

  async listPublished(): Promise<Post[]> {
    const posts = await this.primary.listPublished();
    try {
      const shadowPosts = await this.shadow.listPublished();
      const result = comparePostLists(posts, shadowPosts);
      if (!result.equal) {
        this.log(`[posts-shadow] ${summarizeComparison(result)}`);
      }
    } catch (e) {
      this.log(`[posts-shadow] shadow read failed: ${(e as Error).message}`);
    }
    return posts;
  }
}
