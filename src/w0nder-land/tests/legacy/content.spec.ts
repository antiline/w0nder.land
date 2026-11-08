import { expect, Page, test } from '@playwright/test';
import { article } from '../support/baseline';

/**
 * 대표 콘텐츠의 리치 노드가 실제로 렌더되는지 본다. 시각 테스트의 마스크가 콘텐츠 누락을 가리지 않도록
 * 여기서는 마스크 없이 존재·로드 여부를 직접 확인한다.
 */

/** 본문 이미지는 next/image 를 거쳐 `/_next/image?url=<원본 경로>` 로 렌더된다(현행). 원본 경로로 찾는다. */
const localImage = (page: Page, src: string) => page.locator(`article img[src*="url=${encodeURIComponent(src)}&"]`).first();
const localImageRefs = (id: string) =>
  article(id)
    .references.filter(r => r.kind === 'local' && /\.(png|jpe?g|webp|gif)$/i.test(r.url))
    .map(r => r.url);

test('글 2: 본문이 참조하는 로컬 이미지가 모두 로드된다', async ({ page }) => {
  await page.goto(article('2').routes.canonicalPath);
  const refs = localImageRefs('2');
  expect(refs.length).toBe(6);
  for (const src of refs) {
    const img = localImage(page, src);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});

test('글 1: alt 가 빈 이미지 3장도 렌더된다 (알려진 결함 #20)', async ({ page }) => {
  test.fail(true, '#20: ImageNode 가 alt 없는 이미지를 그리지 않는다. 고친 뒤 이 줄을 지운다.');
  await page.goto(article('1').routes.canonicalPath);
  const refs = localImageRefs('1');
  expect(refs.length).toBe(3);
  for (const src of refs) {await expect(localImage(page, src)).toBeAttached({ timeout: 3_000 });}
});

test('글 4: 본문 비디오 노드가 로컬 mp4 를 가리키고 그 파일이 응답한다', async ({ page, request }) => {
  const a = article('4');
  await page.goto(a.routes.canonicalPath);
  const videos = a.references.filter(r => r.url.endsWith('.mp4')).map(r => r.url);
  expect(videos.length).toBe(2);
  for (const src of videos) {
    await expect(page.locator(`article video[src="${src}"], article video source[src="${src}"]`).first()).toBeAttached();
    expect((await request.head(src)).status()).toBe(200);
  }
});

test('글 5: 트위터 노드 자리가 렌더된다 (트윗 내용은 외부라 검사하지 않음)', async ({ page }) => {
  const a = article('5');
  await page.goto(a.routes.canonicalPath);
  await expect(page.locator('article .react-component').first()).toBeAttached();
});

test('글 1: link-preview 가 제목·URL 과 함께 렌더된다', async ({ page }) => {
  const a = article('1');
  await page.goto(a.routes.canonicalPath);
  const preview = page.locator('article a[href="https://showyourti.me"]').first();
  await expect(preview).toBeVisible();
  await expect(page.locator('article .link-title').first()).toHaveText('Show Your Time');
});

test('공유 모달이 열리고 단축 주소를 보여준다', async ({ page }) => {
  const a = article('1');
  await page.goto(a.routes.canonicalPath);
  await page.getByRole('button', { name: /SHARE/ }).click();
  await expect(page.getByText(a.routes.shortPath!, { exact: false }).first()).toBeVisible();
});
