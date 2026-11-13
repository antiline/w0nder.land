import { expect, test } from '@playwright/test';

test('off 상태에서는 새 경로가 404이고 기존 화면에는 새 링크가 없다', async ({ request, page }) => {
  for (const path of ['/hub', '/subscribe']) {
    // eslint-disable-next-line no-await-in-loop -- 비노출 경로를 각각 검사한다
    expect((await request.get(`http://127.0.0.1:3101${path}`)).status()).toBe(404);
  }
  await page.goto('http://127.0.0.1:3101/');
  await expect(page.locator('a[href="/hub"], a[href="/subscribe"]')).toHaveCount(0);
});

test('구독이 켜져 있으면 허브에서 구독 화면으로 갈 수 있다', async ({ page }) => {
  await page.goto('/hub');
  await page.getByRole('link', { name: '새 글 받아보기', exact: true }).click();
  await expect(page).toHaveURL(/\/subscribe$/);
  await expect(page.getByRole('heading', { name: '새 글 받아보기', exact: true })).toBeVisible();
});

test('구독이 꺼져 있으면 허브에 구독 링크가 없다', async ({ page }) => {
  await page.goto('http://127.0.0.1:3104/hub');
  await expect(page.locator('a[href="/subscribe"]')).toHaveCount(0);
});

test('검색 조건은 URL에 남고 새로고침해도 고정 주소로 연결된다', async ({ page }) => {
  await page.goto('/hub');
  await expect(page.getByRole('heading', { name: '글 찾기', exact: true })).toBeVisible();
  const first = page.locator('main li h2 a').first();
  const title = await first.innerText();
  const permalink = await first.getAttribute('href');
  await page.getByLabel('검색어', { exact: true }).fill(title);
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole('link', { name: title, exact: true }).first()).toHaveAttribute('href', permalink!);
  await page.reload();
  await expect(page.getByLabel('검색어', { exact: true })).toHaveValue(title);
});

test('카테고리 조건과 빈 검색 결과를 초기화할 수 있다', async ({ page }) => {
  await page.goto('/hub?q=존재하지않는검색어-000000&category=TECH');
  await expect(page.getByRole('combobox', { name: '카테고리', exact: true })).toHaveValue('TECH');
  await expect(page.getByRole('heading', { name: '검색 결과가 없습니다' })).toBeVisible();
  await page.getByLabel('검색어', { exact: true }).fill('아직 제출하지 않은 검색어');
  await page.getByRole('combobox', { name: '카테고리', exact: true }).selectOption('LIFE');
  await page.getByRole('link', { name: '검색 초기화' }).click();
  await expect(page.locator('main li h2 a').first()).toBeVisible();
  await expect(page.getByLabel('검색어', { exact: true })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: '카테고리', exact: true })).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('구독 폼은 진행 중 중복 제출을 막고 202를 확인 안내로 표시한다', async ({ page }) => {
  let calls = 0;
  let complete: (() => void) | undefined;
  const pending = new Promise<void>(resolve => {
    complete = resolve;
  });
  await page.route('https://newsletter.example.test/**', async route => {
    if (route.request().method() === 'POST') {
      calls += 1;
      expect(route.request().postDataJSON()).toEqual({
        email: 'reader@example.test',
        website: '',
        scope: 'site',
        locale: 'ko',
      });
      await pending;
    }
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'pending_confirmation' }),
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type' },
    });
  });
  await page.goto('/subscribe');
  await page.getByLabel('이메일 주소', { exact: true }).fill('reader@example.test');
  await page.getByRole('button', { name: '확인 메일 받기' }).click();
  await expect(page.getByRole('button', { name: '요청 중…' })).toBeDisabled();
  await page.getByLabel('이메일 주소', { exact: true }).press('Enter');
  await expect.poll(() => calls).toBe(1);
  complete!();
  await expect(page.getByRole('heading', { name: '메일함을 확인해 주세요' })).toBeVisible();
  expect(calls).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('구독 장애는 주소 등록 여부를 드러내지 않고 자동 재요청하지 않는다', async ({ page }) => {
  let calls = 0;
  await page.route('https://newsletter.example.test/**', async route => {
    calls += 1;
    await route.fulfill({ status: 503, body: 'unavailable', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/subscribe');
  await page.getByLabel('이메일 주소', { exact: true }).fill('reader@example.test');
  await page.getByRole('button', { name: '확인 메일 받기' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('메일함을 먼저 확인');
  await expect(page.getByRole('button', { name: '확인 메일 받기' })).toBeEnabled();
  expect(calls).toBe(1);
});

test('자바스크립트가 없어도 이메일 주소를 URL에 넣지 않는다', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3102/subscribe');
  await page.getByLabel('이메일 주소', { exact: true }).fill('reader@example.test');
  await page.getByRole('button', { name: '확인 메일 받기' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3102/subscribe');
  await context.close();
});
