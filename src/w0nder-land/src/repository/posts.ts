import { join } from 'path';
import * as fs from 'fs';
import { Post } from '@/repository/post-types';
import { postFromMarkdown, sortPostsForList } from '@/repository/post-markdown';

// 타입은 post-types 에 있다. 기존 import 경로를 깨지 않도록 다시 내보낸다.
export { PostType } from '@/repository/post-types';
export type { Post } from '@/repository/post-types';

/** 파일 원천: public/posts/{id}/post.md. 페이지는 이 모듈 대신 src/server/post-reader 를 쓴다. */
const postsDirectory = join(process.cwd(), 'public', 'posts');

export function getPostUuids() {
  return fs.readdirSync(postsDirectory).filter(uuid => {
    const fullPath = join(postsDirectory, uuid, 'post.md');
    return fs.existsSync(fullPath);
  });
}

export function getPostByUuid(uuid: string) {
  const fullPath = join(postsDirectory, uuid, 'post.md');
  return postFromMarkdown(uuid, fs.readFileSync(fullPath, 'utf8'));
}

export function getAllPosts(): Post[] {
  return sortPostsForList(getPostUuids().map(uuid => getPostByUuid(uuid)));
}
