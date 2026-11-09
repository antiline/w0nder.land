/**
 * `<script type="application/ld+json">` 안에 넣을 JSON. 제목·설명·프로필은 모코 API 에서도 오므로
 * 값에 `</script>` 가 있으면 태그를 닫고 스크립트를 끼워 넣을 수 있다. `<` 를 `<` 로 바꿔 막는다.
 * JSON 으로서의 값은 같다(파서가 같은 문자로 읽는다).
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
