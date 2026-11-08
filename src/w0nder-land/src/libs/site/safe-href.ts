/**
 * 외부 원천에서 온 링크 주소의 출력 정책(W5, #10). https·http·mailto 와 사이트 안 경로(`/…`, `//` 제외)만 통과한다.
 * 나머지(`javascript:`, `data:`, 프로토콜 상대 주소 등)는 null.
 */
export function safeHref(url: string): string | null {
  const value = url.trim();
  if (value !== url || value === '') {
    return null;
  }
  if (value.startsWith('/')) {
    return value.startsWith('//') || value.startsWith('/\\') ? null : value;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  return ['https:', 'http:', 'mailto:'].includes(parsed.protocol) ? value : null;
}

/** 새 창으로 열 주소인지(기존 홈과 같은 규칙: http 로 시작하거나 mailto). */
export const isExternalHref = (url: string) => url.startsWith('http') || url.startsWith('mailto:');
