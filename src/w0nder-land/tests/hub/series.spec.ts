import { expect, test } from '@playwright/test';

test('공개 연재 목차와 신규 글을 고정 주소로 읽고 read key는 브라우저에 노출하지 않는다', async ({ page }) => {
  await page.goto('http://127.0.0.1:3104/hub');
  await expect(page.getByRole('heading', { name: '연재 모아보기' })).toBeVisible();
  expect(await page.content()).not.toContain('mk_sec_synthetic');
  await page.getByRole('link', { name: '테스트 연재', exact: true }).click();
  await expect(page.getByRole('heading', { name: '테스트 연재', exact: true })).toBeVisible();
  const post = page.getByRole('link', { name: '제목을 바꾼 새 글', exact: true });
  await expect(post).toHaveAttribute(
    'href',
    '/posts/%EC%B2%98%EC%9D%8C%20%EA%B3%B5%EA%B0%9C%EB%90%9C%20%EC%A3%BC%EC%86%8C',
  );
  await post.click();
  await expect(page.getByRole('heading', { name: '제목을 바꾼 새 글', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/%EC%B2%98%EC%9D%8C/);
});

test('신규 글 사이를 클라이언트로 이동하면 공유 주소도 현재 글로 바뀐다', async ({ page }) => {
  const first = `/posts/${encodeURIComponent('처음 공개된 주소')}`;
  const second = `/posts/${encodeURIComponent('두 번째 고정 주소')}`;
  await page.goto(`http://127.0.0.1:3104${first}`);
  await page.getByRole('button', { name: /SHARE/ }).click();
  const modal = page.getByRole('heading', { name: 'SHARE THIS PAGE', exact: true }).locator('..').locator('..');
  await expect(modal.getByText(first, { exact: false })).toBeVisible();
  await page.evaluate(async href => {
    const next = window as unknown as { next: { router: { push: (url: string) => Promise<boolean> } } };
    await next.next.router.push(href);
  }, second);
  await expect(page.getByRole('heading', { name: '두 번째 새 글', exact: true })).toBeVisible();
  await expect(modal.getByText(second, { exact: false })).toBeVisible();
});
