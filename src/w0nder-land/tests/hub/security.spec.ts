import { expect, test } from '@playwright/test';

/**
 * 모코 원천(3104, tests/support/fake-mocco.mjs)에서 들어오는 글의 공개 경계.
 * legacy/security.spec.ts 에 비워 두었던 fixture 세 가지를 여기서 채운다.
 */
const base = 'http://127.0.0.1:3104';
const pathOf = (permalinkTail: string) => `/posts/${encodeURIComponent(permalinkTail)}`;

test('외부에서 작성된 본문의 스크립트·이벤트 속성·javascript: 주소가 실행되지 않는다', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.goto(`${base}${pathOf('외부 본문 보안 점검')}`);
  await expect(page.getByRole('heading', { name: '외부 본문 보안 점검', exact: true })).toBeVisible();
  const body = page.locator('article .ProseMirror');
  await expect(body).toContainText('첫 문단입니다.');
  await expect(body).toContainText('마지막 문단입니다.');

  const unsafe = await page.evaluate(() => {
    const root = document.querySelector('article .ProseMirror')!;
    const all = Array.from(root.querySelectorAll('*'));
    return {
      scripts: root.querySelectorAll('script, iframe, object, embed').length,
      handlers: all.flatMap(el => el.getAttributeNames().filter(name => name.startsWith('on'))),
      jsUrls: all.flatMap(el =>
        ['href', 'src', 'action', 'formaction', 'xlink:href']
          .map(name => el.getAttribute(name) ?? '')
          .filter(value => /^\s*javascript:/i.test(value)),
      ),
    };
  });
  expect(unsafe).toEqual({ scripts: 0, handlers: [], jsUrls: [] });

  // 남아 있는 링크를 실제로 눌러도 코드가 실행되지 않는다.
  for (const link of await body.locator('a').all()) {
    // eslint-disable-next-line no-await-in-loop -- 링크마다 클릭 결과를 따로 본다
    await link.click({ modifiers: [], trial: false, noWaitAfter: true }).catch(() => undefined);
    // eslint-disable-next-line no-await-in-loop -- 클릭 뒤 같은 문서에 남아 있어야 검사할 수 있다
    if (!page.url().startsWith(base)) {
      // eslint-disable-next-line no-await-in-loop -- 원래 글로 돌아간다
      await page.goBack();
    }
  }
  expect(await page.evaluate(() => (window as unknown as { xssFired?: string }).xssFired)).toBeUndefined();
  expect(dialogs).toEqual([]);
});

test('목록에 없는 초안과 다른 발행물의 글은 공개 주소로 열리지 않는다', async ({ request }) => {
  for (const path of [
    pathOf('숨은 초안'),
    pathOf('다른 소유자의 글'),
    '/posts/7c1d1d2a-2f60-4f0b-8f43-5f2b1c1c0b22',
    '/posts/9a7f3f40-1d0e-4c1b-a7f1-3b0d6a5e0c33',
  ]) {
    // eslint-disable-next-line no-await-in-loop -- 주소마다 응답을 따로 본다
    const res = await request.get(`${base}${path}`, { maxRedirects: 0 });
    expect(res.status(), path).toBe(404);
    // eslint-disable-next-line no-await-in-loop -- 본문까지 확인한다
    const html = await res.text();
    expect(html).not.toContain('숨은 초안');
    expect(html).not.toContain('다른 소유자의 글');
  }
  for (const path of ['/hub', '/hub?q=숨은', '/posts', '/rss.xml', '/sitemap.xml']) {
    // eslint-disable-next-line no-await-in-loop -- 노출 지점마다 본다
    const html = await (await request.get(`${base}${path}`)).text();
    expect(html, path).not.toContain('숨은 초안');
    expect(html, path).not.toContain('다른 소유자의 글');
  }
});

test('미리보기 진입점이 없고 미리보기 쿠키를 보내도 공개 응답과 같다', async ({ request, browser }) => {
  for (const path of ['/api/preview', '/api/draft', '/api/preview?secret=x&slug=/posts/1']) {
    // eslint-disable-next-line no-await-in-loop -- 진입점마다 본다
    const res = await request.get(`${base}${path}`, { maxRedirects: 0 });
    expect(res.status(), path).toBe(404);
    expect(res.headers()['set-cookie'] ?? '', path).not.toMatch(/__prerender_bypass|__next_preview_data/);
  }
  const target = `${base}${pathOf('처음 공개된 주소')}`;
  const plain = await request.get(target);
  const context = await browser.newContext();
  await context.addCookies([
    { name: '__prerender_bypass', value: 'forged', url: base },
    { name: '__next_preview_data', value: 'forged', url: base },
  ]);
  const forged = await context.request.get(target);
  expect(forged.status()).toBe(plain.status());
  expect(forged.headers()['cache-control']).toBe(plain.headers()['cache-control']);
  expect(await forged.text()).not.toContain('숨은 초안');
  await context.close();
});
