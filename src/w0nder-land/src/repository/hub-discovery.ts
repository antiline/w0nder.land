import type { Post } from '@/repository/post-types';

const normalized = (text: string) => text.normalize('NFC').toLocaleLowerCase('ko');

/** PostReader가 돌려준 발행본만 검색한다. 원래 순서와 고정 permalink를 유지한다. */
export function discoverPosts(posts: Post[], query: string, category: string): Post[] {
  const words = normalized(query.trim()).split(/\s+/).filter(Boolean);
  return posts.filter(post => {
    if (category && normalized(post.category ?? '') !== normalized(category)) {
      return false;
    }
    const text = normalized([post.title, post.article, ...post.tags].join('\n'));
    return words.every(word => text.includes(word));
  });
}
