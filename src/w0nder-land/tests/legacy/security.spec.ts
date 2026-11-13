import { expect, test } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 공개 표면의 보안 경계. 모코 연결(W3) 이후 API 키·초안·외부 콘텐츠가 들어오면 여기서 막는다.
 */
const staticDir = join(__dirname, '..', '..', '.next', 'static');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * 서버 전용 환경변수. `src/constants/configure.ts` 가 공용 클래스라 **이름**(process.env.X 참조)은 번들에 들어가지만
 * NEXT_PUBLIC_ 이 아니므로 값은 인라인되지 않는다. 그래서 값으로 검사한다.
 * 검사하려면 빌드할 때 이 변수들에 실제 값이나 sentinel 을 넣는다. 새 서버 비밀(예: 모코 read key)은 여기에 추가한다.
 */
const SERVER_ONLY_ENV = ['SLACK_ACCESS_TOKEN', 'SLACK_CHANNEL_ID_BINARY_BOOK_CLUB', 'MOCCO_BLOG_READ_KEY'];
const SECRET_SHAPES = [/xox[abp]-[0-9A-Za-z-]{10,}/];

test('클라이언트 번들에 서버 전용 비밀 값이 없다', () => {
  test.skip(!!process.env.BASE_URL || !existsSync(staticDir), '로컬 next build 산출물이 있어야 검사한다');
  const values = SERVER_ONLY_ENV.map(k => process.env[k]).filter((v): v is string => !!v && v.length >= 8);
  const leaks: string[] = [];
  for (const file of walk(staticDir).filter(f => f.endsWith('.js'))) {
    const js = readFileSync(file, 'utf8');
    for (const v of values) {if (js.includes(v)) {leaks.push(`${file.slice(staticDir.length)} ~ env 값`);}}
    for (const re of SECRET_SHAPES) {if (re.test(js)) {leaks.push(`${file.slice(staticDir.length)} ~ ${re}`);}}
  }
  expect(leaks).toEqual([]);
});

// 모코 원천의 본문 XSS·초안/다른 발행물 노출·미리보기 캐시 fixture 는 모의 모코가 필요해서
// tests/hub/security.spec.ts(yarn test:hub)에 있다.
