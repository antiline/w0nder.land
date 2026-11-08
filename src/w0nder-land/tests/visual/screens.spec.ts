import { expect, Page, test } from '@playwright/test';
import { animatedImagePaths, article } from '../support/baseline';

/**
 * 대표 화면의 시각 기준선(PC 1440×900, 모바일 390×844). 픽셀 비교는 로컬 빌드에서만 돌린다.
 *
 * 격리 규칙(baseline/README.md):
 * - 같은 origin 이 아닌 요청은 모두 막는다(광고·트윗·외부 미리보기 이미지·분석 스크립트).
 * - 광고 슬롯, 트윗 노드, 외부 미리보기 이미지, 비디오, 푸터 연도는 mask 한다. 크기와 위치는 그대로 비교된다.
 * - 콘텐츠가 실제로 있는지는 legacy/content.spec.ts 가 마스크 없이 따로 검사한다.
 */
test.skip(!!process.env.BASE_URL, '시각 비교는 로컬 빌드에서만 한다');
// full-page 캡처는 이미지 로드를 기다리므로 병렬 실행 부하에서 30초를 넘길 수 있다.
test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page, baseURL }) => {
  const { origin } = new URL(baseURL!);
  await page.route('**/*', route => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
});

const masks = (page: Page) => [
  page.locator('.adsense-container, ins.adsbygoogle, [data-ad-slot]'),
  page.locator('article .react-component'),
  page.locator('article img[src^="http"]'),
  page.locator('video'),
  // 애니메이션 이미지는 프레임이 매번 달라 mask 한다. 로드 여부는 legacy/content.spec.ts 가 따로 본다.
  ...animatedImagePaths().map(src => page.locator(`img[src*="url=${encodeURIComponent(src)}&"]`)),
  page.getByText(/©\s*\d{4}/),
];

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const imgs = Array.from(document.images).filter(img => img.src.startsWith(window.location.origin));
    imgs.forEach(img => img.setAttribute('loading', 'eager'));
    await Promise.all(
      imgs
        .filter(img => !img.complete)
        .map(
          img =>
            new Promise(resolve => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            }),
        ),
    );
  });
}

test('홈', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  await expect(page).toHaveScreenshot('home.png', { fullPage: true, mask: masks(page) });
});

test('글 목록 첫 화면', async ({ page }) => {
  await page.goto('/posts');
  await settle(page);
  await expect(page).toHaveScreenshot('posts.png', { mask: masks(page) });
});

test('글 상세 (이미지·link-preview 포함, 글 1)', async ({ page }) => {
  await page.goto(article('1').routes.canonicalPath);
  await settle(page);
  await expect(page).toHaveScreenshot('post-1.png', { fullPage: true, mask: masks(page) });
});

test('글 상세 공유 모달', async ({ page }) => {
  await page.goto(article('1').routes.canonicalPath);
  await settle(page);
  await expect(page.locator('article .ProseMirror')).toBeVisible();
  await page.getByRole('button', { name: /SHARE/ }).click();
  await expect(page).toHaveScreenshot('post-1-share.png', { mask: masks(page) });
});
