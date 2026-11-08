/** 공개 렌더러가 쓰는 글 모양. 데이터 원천(파일·모코)과 무관하게 이 모양을 유지한다. 클라이언트에서 import 해도 안전하다. */
export enum PostType {
  Markdown = 'Markdown',
}

interface BasePost {
  uuid: string;
  shortUrl: string;
  title: string;
  tags: string[];
  category?: string;
  author: string;
  authorProfile: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
}

interface MarkdownPost extends BasePost {
  type: PostType.Markdown;
  article: string;
}

export type Post = MarkdownPost;
