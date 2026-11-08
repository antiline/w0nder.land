/**
 * manifest 에서 URL 검사 케이스를 만든다. probe-urls.mjs(운영·임의 서버 관측)와
 * tests/legacy/http.spec.ts(Playwright 회귀 테스트)가 같은 정의를 쓴다.
 *
 * kind:
 * - contract: 보존·복구해야 할 정상 동작. 바뀌면 회귀다.
 * - characterization: 현재 동작을 기록한 것. 의도한 변경이면 이유를 남기고 기대값을 고친다.
 * fixedBy: 과거 결함을 복구한 기대값이면 그 이슈. 결함을 "보존"하지 않는다는 표시다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// import.meta 를 쓰지 않는다. Playwright 가 테스트를 CommonJS 로 변환해 불러오기 때문이다. 앱 루트는 호출자가 넘긴다.
export function loadManifest(appRoot) {
  return JSON.parse(readFileSync(join(appRoot, 'baseline', 'legacy-content-manifest.json'), 'utf8'));
}

/** @returns {{path:string, group:string, kind:'contract'|'characterization', legacyId?:string, fixedBy?:string, expected:{status:number|number[], location?:string}}[]} */
export function buildCases(manifest) {
  const cases = [];
  for (const a of manifest.articles) {
    const r = a.routes;
    const id = a.legacyId;
    cases.push({ group: 'canonical', kind: 'contract', fixedBy: '#15', legacyId: id, path: r.canonicalPath, expected: { status: 200 } });
    // 쿼리 문자열은 글 판별에 영향을 주지 않아야 한다
    cases.push({ group: 'canonicalWithQuery', kind: 'contract', fixedBy: '#15', legacyId: id, path: `${r.canonicalPath}?utm_source=baseline`, expected: { status: 200 } });
    cases.push({ group: 'doubleEncodedAlias', kind: 'contract', legacyId: id, path: r.doubleEncodedPath, expected: { status: 200 } });
    cases.push({ group: 'bareId', kind: 'contract', legacyId: id, path: r.bareIdPath, expected: { status: 200 } });
    if (r.shortPath) cases.push({ group: 'short', kind: 'contract', legacyId: id, path: r.shortPath, expected: { status: 307, location: r.canonicalPath } });
  }
  for (const s of manifest.siteRoutes) {
    const expected = s.kind === 'redirect' ? { status: 307, location: s.expectedTarget } : { status: s.expectedStatus ?? 200 };
    // /about 의 307(permanent:false), url 없는 OG 의 404 는 현행 기록이다
    const kind = s.path === '/about' || s.expectedStatus === 404 ? 'characterization' : 'contract';
    cases.push({ group: `site:${s.kind}`, kind, path: s.path, expected });
  }
  // 임의 제목·없는 글·인코딩 오류는 유효한 글로 바뀌면 안 된다. 400(디코딩 거부)도 안전한 거부로 본다.
  const first = manifest.articles[0];
  const invalid = [
    `/posts/${first.legacyId}-__baseline_wrong_title__`,
    `/posts/${first.legacyId}-${encodeURIComponent('잘못된 제목')}`,
    '/posts/999999',
    '/posts/999999-anything',
    `/posts/${first.legacyId}-%E0%A4%A`, // 깨진 퍼센트 인코딩
    `/posts/${first.legacyId}-..%2F..%2Fetc%2Fpasswd`,
    `/posts/${encodeURIComponent(encodeURIComponent(first.routes.canonicalPath.slice(7)))}`, // 삼중 인코딩
  ];
  for (const path of invalid) cases.push({ group: 'invalid', kind: 'contract', path, expected: { status: [404, 400] } });
  for (const f of manifest.staticFiles) cases.push({ group: 'static', kind: 'contract', path: encodeURI(f.publicPath), expected: { status: 200 } });
  for (const a of manifest.articles)
    for (const f of a.assets)
      cases.push({ group: 'articleAsset', kind: 'contract', legacyId: a.legacyId, path: encodeURI(f.publicPath), expected: { status: 200 } });
  return cases;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
/** 로컬 서버는 Location 을 localhost 로 만들 수 있다. 루프백 주소끼리는 같은 origin 으로 본다. */
const sameOrigin = (a, b) =>
  a.origin === b.origin || (LOOPBACK.has(a.hostname) && LOOPBACK.has(b.hostname) && a.port === b.port && a.protocol === b.protocol);

/** 같은 origin 의 Location 은 path+query 로 줄여 비교한다. */
export function normalizeLocation(location, base) {
  if (!location) return location;
  try {
    const u = new URL(location, base);
    return sameOrigin(u, new URL(base)) ? `${u.pathname}${u.search}` : location;
  } catch {
    return location;
  }
}

export function matchesExpected(c, status, location, base) {
  return [c.expected.status].flat().includes(status) && (c.expected.location === undefined || normalizeLocation(location, base) === c.expected.location);
}
