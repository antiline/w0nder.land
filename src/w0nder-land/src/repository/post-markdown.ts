import matter from 'gray-matter';
import { getPostUrl } from '@/libs/utils/urls';
import { Post, PostType } from '@/repository/post-types';

/**
 * 원문(frontmatter + 본문) → Post. 파일 원천과 모코 원천이 같은 함수를 써서 DTO 가 같아지게 한다.
 * 기본값(빈 문자열·빈 배열)과 url·shortUrl 규칙은 기존 파일 저장소의 동작 그대로다.
 */
export function postFromMarkdown(uuid: string, text: string): Post {
  const { data, content } = matter(text);
  const native = data.moccoNative === true;
  if (native && (typeof data.moccoPermalink !== 'string' || !/^\/posts\/[^/\\\s?#]+$/.test(data.moccoPermalink))) {
    throw new Error('신규 글 롤백 파일의 고정 주소가 잘못됐다');
  }
  if (native) {
    // 잘못된 퍼센트 인코딩은 경로 해석 단계 전에 거부한다.
    decodeURIComponent(data.moccoPermalink);
  }

  return {
    type: PostType.Markdown,
    uuid,
    author: data.author || '',
    authorProfile: data.authorProfile || '',
    title: data.title || '',
    keywords: data.keywords || [],
    category: data.category || '',
    article: content,
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
    url: native ? data.moccoPermalink : getPostUrl(uuid, data.title || ''),
    shortUrl: native && !data.shortUrl ? '' : `/s/${data.shortUrl || ''}`,
    tags: data.tags || [],
  } satisfies Post;
}

/** 목록 순서: createdAt 문자열 내림차순(기존 getAllPosts 와 같다). */
export function sortPostsForList(posts: Post[]): Post[] {
  return [...posts].sort((post1, post2) => (post1.createdAt > post2.createdAt ? -1 : 1));
}
