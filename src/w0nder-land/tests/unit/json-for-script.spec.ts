import { expect, test } from '@playwright/test';
import { jsonForScript } from '@/libs/site/json-for-script';

test('JSON-LD 값의 </script> 가 태그를 닫지 못하고, 값은 그대로 읽힌다', () => {
  const value = { headline: '</script><script>alert(1)</script>', name: 'a < b', plain: '한글 제목' };
  const out = jsonForScript(value);
  expect(out).not.toContain('<');
  expect(JSON.parse(out)).toEqual(value);
  // `<` 가 없는 값은 JSON.stringify 와 바이트가 같다(기존 82개 글은 모두 이 경우).
  expect(jsonForScript({ name: '한글 & "따옴표"' })).toBe(JSON.stringify({ name: '한글 & "따옴표"' }));
});
