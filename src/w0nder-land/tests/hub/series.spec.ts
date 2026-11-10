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
