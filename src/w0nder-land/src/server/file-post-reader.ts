import type { Post } from '@/repository/post-types';
import { getAllPosts } from '@/repository/posts';
import type { PostReader } from '@/server/post-reader-port';

/** 저장소의 public/posts 를 읽는다. 지금 운영과 같은 기본 원천이다. */
export class FilePostReader implements PostReader {
  // eslint-disable-next-line class-methods-use-this -- 원천마다 같은 포트를 구현한다
  async listPublished(): Promise<Post[]> {
    return getAllPosts();
  }
}
