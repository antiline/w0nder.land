import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { postFromMarkdown } from '@/repository/post-markdown';

test('신규 글도 파일로 롤백하면 제목·본문·날짜·고정 permalink가 유지된다', async () => {
  const id = 'f6885bc7-0b48-446e-8c5b-c78499ba5c47';
  const native = {
    id,
    legacyId: null,
    status: 'public',
    permalink: '/posts/처음 주소',
    frontmatter: null,
    bodyMd: '첫 줄\r\n\n마지막 줄',
    title: '수정된 제목',
    category: 'TECH',
    tags: ['태그'],
    createdAtText: null,
    updatedAtText: null,
    firstMadePublicAt: '2026-11-10T00:00:00.000Z',
    author: { displayName: '테스트 작성자', avatar: '/images/profile_image.png' },
    aliases: [],
    assets: [],
  };
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify(
        request.url?.startsWith('/v1/blog/posts?')
          ? { items: [{ id, legacyId: null, status: 'public' }], nextCursor: null }
          : native,
      ),
    );
  });
  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('테스트 서버 주소 없음');
  }
  const dir = mkdtempSync(join(tmpdir(), 'native-rollback-'));
  const run = () =>
    new Promise<number | null>((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/mocco-export.mjs', '--write', `--dir=${dir}`], {
        env: {
          ...process.env,
          MOCCO_API_URL: `http://127.0.0.1:${address.port}`,
          MOCCO_BLOG_READ_KEY: 'mk_sec_synthetic',
        },
        stdio: 'ignore',
      });
      child.on('error', reject);
      child.on('exit', resolve);
    });
  try {
    expect(await run()).toBe(0);
    const text = readFileSync(join(dir, id, 'post.md'), 'utf8');
    expect(postFromMarkdown(id, text)).toMatchObject({
      title: native.title,
      article: native.bodyMd,
      createdAt: native.firstMadePublicAt,
      updatedAt: native.firstMadePublicAt,
      shortUrl: '',
      url: '/posts/%EC%B2%98%EC%9D%8C%20%EC%A3%BC%EC%86%8C',
    });
    expect(await run()).toBe(0);
    expect(readFileSync(join(dir, id, 'post.md'), 'utf8')).toBe(text);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
    rmSync(dir, { recursive: true, force: true });
  }
});

test('두 번째 파일을 쓸 수 없으면 앞서 있던 글도 바꾸지 않는다', async () => {
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
  const details = ids.map((id, index) => ({
    id,
    legacyId: String(index + 1),
    status: 'public',
    frontmatter: '---\ntitle: "새 제목"\n---\n',
    bodyMd: '새 본문',
    assets: [],
  }));
  const dir = mkdtempSync(join(tmpdir(), 'rollback-failed-write-'));
  mkdirSync(join(dir, '1'));
  const original = '---\ntitle: "기존 제목"\n---\n기존 본문';
  writeFileSync(join(dir, '1', 'post.md'), original);
  writeFileSync(join(dir, '2'), '글 폴더 자리를 차지한 파일');
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify(
        request.url?.includes('?')
          ? { items: details, nextCursor: null }
          : details.find(post => request.url?.endsWith(post.id)),
      ),
    );
  });
  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('테스트 서버 주소 없음');
  }
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/mocco-export.mjs', '--write', `--dir=${dir}`], {
        env: {
          ...process.env,
          MOCCO_API_URL: `http://127.0.0.1:${address.port}`,
          MOCCO_BLOG_READ_KEY: 'mk_sec_synthetic',
        },
        stdio: 'ignore',
      });
      child.on('error', reject);
      child.on('exit', resolve);
    });
    expect(code).toBe(1);
    expect(readFileSync(join(dir, '1', 'post.md'), 'utf8')).toBe(original);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
    rmSync(dir, { recursive: true, force: true });
  }
});
