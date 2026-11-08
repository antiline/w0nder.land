import { expect, test } from '@playwright/test';
import { isExpected, manifest, toPath, urlCases } from '../support/baseline';

/**
 * 서버가 돌려주는 HTTP 동작(리다이렉트를 따라가지 않은 첫 응답). 브라우저 hydration 뒤 이동은 navigation.spec.ts.
 * 케이스 정의: scripts/baseline/cases.mjs. kind=characterization 은 현재 동작의 기록이다.
 */
const groups = Array.from(new Set(urlCases.map(c => c.group)));

for (const group of groups) {
  const cases = urlCases.filter(c => c.group === group);

  test(`${group} (${cases.length}) — GET·HEAD 상태와 Location`, async ({ request, baseURL }) => {
    test.setTimeout(30_000 + cases.length * 2_000);
    const failures: string[] = [];
    for (const c of cases) {
      for (const method of ['GET', 'HEAD'] as const) {
        // 운영 앞단은 깨진 퍼센트 인코딩에 비정상 응답(HEAD 에서 'Data after Connection: close')을 준다(현행 기록).
        // 무효 입력이 거부된 것이므로 invalid 그룹에서만 안전한 거부로 본다.
        const res = await request
          .fetch(c.path, { method, maxRedirects: 0, failOnStatusCode: false })
          .catch((e: Error) => {
            if (c.group !== 'invalid') {
              failures.push(`${method} ${c.path} → ${String(e).split('\n')[0]}`);
            }
            return null;
          });
        const location = res?.headers().location;
        if (res && !isExpected(c, res.status(), location, baseURL!)) {
          failures.push(
            `${method} ${c.path} → ${res.status()} ${toPath(location, baseURL!) ?? ''} (기대 ${JSON.stringify(c.expected)}${c.fixedBy ? `, ${c.fixedBy}` : ''})`,
          );
        }
      }
    }
    expect(failures, failures.slice(0, 10).join('\n')).toEqual([]);
  });
}

test('글 상세 HTML 에는 rel=canonical 이 없다 (현행 기록, 추가는 별도 SEO 결정)', async ({ request }) => {
  for (const id of ['1', manifest.listOrder[0]]) {
    const a = manifest.articles.find(x => x.legacyId === id)!;
    const html = await (await request.get(a.routes.canonicalPath)).text();
    expect(html).not.toMatch(/<link[^>]+rel=["']canonical["']/i);
    expect(html).toMatch(/<title[^>]*>[^<]+<\/title>/);
  }
});

test('서버 HTML 의 본문은 .sr-only 안의 원문 마크다운이고, 보이는 본문은 클라이언트가 그린다 (현행 기록)', async ({ request }) => {
  // BlogPostDetail 의 <div class="sr-only"><p>{content}</p></div>. 크롤러는 원문을 보고, 보조기술은 원문과 렌더 결과를 둘 다 읽을 수 있다.
  // 바꾸려면 SEO·접근성 결정을 거쳐 기대값을 고친다.
  const html = await (await request.get(manifest.articles.find(a => a.legacyId === '1')!.routes.canonicalPath)).text();
  const body = html.split('<body')[1].split('<script id="__NEXT_DATA__"')[0];
  const srOnly = body.match(/<div class="sr-only"><p>([\s\S]*?)<\/p><\/div>/);
  expect(srOnly?.[1]).toContain('어떤 프로젝트를 진행할 때');
  expect(srOnly?.[1]).toContain('&lt;link-preview');
  const outsideSrOnly = body.replace(srOnly![0], '');
  expect(outsideSrOnly).toContain('<h1');
  expect(outsideSrOnly).not.toContain('어떤 프로젝트를 진행할 때');
});

test('sitemap 과 RSS 는 manifest 의 정식 주소·guid 를 그대로 내보낸다', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const rss = await (await request.get('/rss.xml')).text();
  const locs = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), m => new URL(m[1]).pathname);
  expect(new Set(locs)).toEqual(new Set(manifest.articles.map(a => a.routes.canonicalPath)));
  const guids = Array.from(rss.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g), m => m[1]);
  expect(new Set(guids)).toEqual(new Set(manifest.articles.map(a => a.legacyId)));
});
