// Local synthetic public API for consumer integration tests. Never contacts Mocco or sends mail.
import { createServer } from 'node:http';

const id = 'f6885bc7-0b48-446e-8c5b-c78499ba5c47';
const post = {
  id,
  legacyId: null,
  status: 'public',
  title: '제목을 바꾼 새 글',
  permalink: '/posts/처음 공개된 주소',
  frontmatter: null,
  bodyMd: '모의 서버에서만 제공하는 공개 글입니다.',
  category: 'TECH',
  tags: ['테스트'],
  createdAtText: null,
  updatedAtText: null,
  firstMadePublicAt: '2026-11-10T00:00:00.000Z',
  author: { displayName: '테스트 작성자', avatar: '/images/profile_image.png' },
  aliases: [],
};
const series = { id, title: '테스트 연재', slug: 'synthetic-series', status: 'ongoing', postCount: 1 };
const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.url === '/ready') {
    response.end('{}');
    return;
  }
  if (request.headers.authorization !== 'Bearer mk_sec_synthetic') {
    response.writeHead(401).end('{}');
    return;
  }
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/v1/blog/posts') {
    response.end(JSON.stringify({ items: [{ id, legacyId: null, status: 'public' }], nextCursor: null }));
  } else if (path === `/v1/blog/posts/${id}`) {
    response.end(JSON.stringify(post));
  } else if (path === '/v1/blog/series') {
    response.end(JSON.stringify({ items: [series], nextCursor: null }));
  } else if (path === `/v1/blog/series/${id}`) {
    response.end(JSON.stringify({ ...series, posts: [post] }));
  } else {
    response.writeHead(404).end('{}');
  }
});
server.listen(3105, '127.0.0.1');
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
