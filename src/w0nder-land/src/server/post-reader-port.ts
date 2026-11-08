import type { Post } from '@/repository/post-types';

export interface PostReader {
  /** 공개된 글 전체, 목록 순서(createdAt 내림차순)로. */
  listPublished(): Promise<Post[]>;
}
