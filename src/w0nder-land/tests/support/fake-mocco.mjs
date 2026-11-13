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
const nextPost = {
  ...post,
  id: 'df5b7a98-6de0-452b-b4bc-d14a5fb3d744',
  title: '두 번째 새 글',
  permalink: '/posts/두 번째 고정 주소',
  firstMadePublicAt: '2026-11-10T01:00:00.000Z',
};
// 외부(모코)에서 작성된 본문이 브라우저에서 코드를 실행하지 못하는지 보는 글. 실행되면 window.xssFired 가 생긴다.
const hostilePost = {
  ...post,
  id: '0b7d1f0e-5d5c-4a63-9c39-6f0f3c3c0a11',
  title: '외부 본문 보안 점검',
  permalink: '/posts/외부 본문 보안 점검',
  firstMadePublicAt: '2026-11-09T00:00:00.000Z',
  bodyMd: [
    '첫 문단입니다.',
    '<script>window.xssFired = "script"</script>',
    '<img src="/x-missing.png" onerror="window.xssFired = \'img-onerror\'">',
    '<p onclick="window.xssFired = \'onclick\'" id="xss-click">눌러 보기</p>',
    '[자바스크립트 링크](javascript:window.xssFired=\'md-link\')',
    '<a id="xss-anchor" href="javascript:window.xssFired=\'html-link\'">HTML 링크</a>',
    '<link-preview url="javascript:window.xssFired=\'preview\'" title="미리보기 링크" description="d" image="javascript:alert(1)"></link-preview>',
    '<iframe src="javascript:window.parent.xssFired=\'iframe\'"></iframe>',
    '<svg><script>window.xssFired = "svg"</script></svg>',
    '마지막 문단입니다.',
  ].join('\n\n'),
};
// 목록에 없는 초안과 다른 발행물의 글. 상세 주소는 응답하지만 공개 사이트에 나오면 안 된다.
const hiddenDrafts = [
  { ...post, id: '7c1d1d2a-2f60-4f0b-8f43-5f2b1c1c0b22', status: 'draft', title: '숨은 초안', permalink: '/posts/숨은 초안' },
  {
    ...post,
    id: '9a7f3f40-1d0e-4c1b-a7f1-3b0d6a5e0c33',
    title: '다른 소유자의 글',
    permalink: '/posts/다른 소유자의 글',
  },
];
const posts = [post, nextPost, hostilePost];
const series = { id, title: '테스트 연재', slug: 'synthetic-series', status: 'ongoing', postCount: 2 };
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
    response.end(
      JSON.stringify({
        items: posts.map(value => ({ id: value.id, legacyId: null, status: 'public' })),
        nextCursor: null,
      }),
    );
  } else if ([...posts, ...hiddenDrafts].some(value => path === `/v1/blog/posts/${value.id}`)) {
    response.end(JSON.stringify([...posts, ...hiddenDrafts].find(value => path === `/v1/blog/posts/${value.id}`)));
  } else if (path === '/v1/blog/series') {
    response.end(JSON.stringify({ items: [series], nextCursor: null }));
  } else if (path === `/v1/blog/series/${id}`) {
    response.end(JSON.stringify({ ...series, posts: [post, nextPost] }));
  } else {
    response.writeHead(404).end('{}');
  }
});
server.listen(3105, '127.0.0.1');
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
