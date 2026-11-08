import { expect, test } from '@playwright/test';
import { article, manifest } from '../support/baseline';

/**
 * 브라우저에서 보이는 이동. 서버 리다이렉트(307)와 hydration 뒤 router.replace 를 구분한다.
 */
const first = article('1');
const latest = article(manifest.listOrder[0]);
const heading = (title: string) => ({ name: title, level: 1 });

test('bare ID: 서버는 200 으로 바로 렌더하고, hydration 뒤 router.replace 가 정식 주소로 바꾼다', async ({ page }) => {
  const res = await page.goto(first.routes.bareIdPath);
  expect(res?.status()).toBe(200);
  expect(res?.url()).toMatch(/\/posts\/1$/); // 서버 단계에서는 이동 없음
  await page.waitForURL(url => url.pathname === first.routes.canonicalPath);
  await expect(page.getByRole('heading', heading(first.title))).toBeVisible();
});

test('단축 주소: 서버 307 로 정식 주소에 도착하고 글이 열린다', async ({ page }) => {
  const res = await page.goto(first.routes.shortPath!);
  expect(res?.request().redirectedFrom()?.url()).toContain(first.routes.shortPath!);
  expect(new URL(page.url()).pathname).toBe(first.routes.canonicalPath);
  await expect(page.getByRole('heading', heading(first.title))).toBeVisible();
});

test('/posts/latest: 서버 307 로 최신 글에 도착한다', async ({ page }) => {
  await page.goto('/posts/latest');
  expect(new URL(page.url()).pathname).toBe(latest.routes.canonicalPath);
  await expect(page.getByRole('heading', heading(latest.title))).toBeVisible();
});

test('이중 인코딩 legacy 주소: 주소를 바꾸지 않고 그 자리에서 글을 연다 (현행 기록)', async ({ page }) => {
  const res = await page.goto(first.routes.doubleEncodedPath);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', heading(first.title))).toBeVisible();
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe(first.routes.doubleEncodedPath);
});

test('목록에서 글을 누르면 클라이언트 이동으로 정식 주소의 글이 열린다 (#15 복구 기대값)', async ({ page }) => {
  await page.goto('/posts');
  // + 와 공백이 섞인 제목(글 30)과 최신 글
  for (const a of [article('30'), latest]) {
    await page.goto('/posts');
    await page.locator(`a[href="${a.routes.canonicalPath}"]`).first().click();
    await page.waitForURL(url => url.pathname === a.routes.canonicalPath);
    await expect(page.getByRole('heading', heading(a.title))).toBeVisible();
  }
});

test('목록은 manifest 의 글을 모두 링크한다', async ({ page }) => {
  await page.goto('/posts');
  const links = page.locator('a[href^="/posts/"]');
  await expect(links).toHaveCount(manifest.articles.length);
});

test('홈의 Blog 링크는 /posts 로 간다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Blog/ }).first().click();
  await page.waitForURL('**/posts');
});
