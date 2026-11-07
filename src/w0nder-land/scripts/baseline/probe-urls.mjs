#!/usr/bin/env node
/**
 * W1/W10 — manifest 의 모든 주소에 GET·HEAD 를 보내 상태·Location·canonical 유무를 기록한다.
 * 읽기 전용 요청만 보낸다(리다이렉트는 따라가지 않는다).
 *
 *   node scripts/baseline/probe-urls.mjs https://w0nder.land  baseline/url-observations.production.json
 *   node scripts/baseline/probe-urls.mjs http://localhost:3100 --expect     # 기대값 대조, 실패 시 exit 1
 *
 * observed 는 그때의 사실이고 expected 는 "보존해야 할 정상 동작"이다. 둘을 섞지 않는다.
 * canonicalPath 의 expected 200 은 W10 복구 목표다(운영 관측은 404 였다).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(readFileSync(join(appRoot, 'baseline', 'legacy-content-manifest.json'), 'utf8'));

const [base, ...rest] = process.argv.slice(2);
if (!base) {
  console.error('usage: probe-urls.mjs <baseUrl> [outFile] [--expect] [--concurrency=N]');
  process.exit(2);
}
const expectMode = rest.includes('--expect');
const outFile = rest.find(a => !a.startsWith('--'));
const concurrency = Number((rest.find(a => a.startsWith('--concurrency=')) || '--concurrency=6').split('=')[1]);

/** @type {{path:string, group:string, legacyId?:string, expected:{status:number, location?:string}}[]} */
const cases = [];
for (const a of manifest.articles) {
  const r = a.routes;
  const id = a.legacyId;
  cases.push({ group: 'canonical', legacyId: id, path: r.canonicalPath, expected: { status: 200 } });
  cases.push({ group: 'doubleEncodedAlias', legacyId: id, path: r.doubleEncodedPath, expected: { status: 200 } });
  cases.push({ group: 'bareId', legacyId: id, path: r.bareIdPath, expected: { status: 200 } });
  if (r.shortPath) cases.push({ group: 'short', legacyId: id, path: r.shortPath, expected: { status: 307, location: r.canonicalPath } });
  // 쿼리 문자열은 글 판별에 영향을 주지 않아야 한다
  cases.push({ group: 'canonicalWithQuery', legacyId: id, path: `${r.canonicalPath}?utm_source=baseline`, expected: { status: 200 } });
}
for (const s of manifest.siteRoutes) {
  const expected = s.kind === 'redirect' ? { status: 307, location: s.expectedTarget } : { status: s.expectedStatus ?? 200 };
  cases.push({ group: `site:${s.kind}`, path: s.path, expected });
}
// 임의 제목·없는 글·인코딩 오류는 유효한 글로 바뀌면 안 된다
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
// 400(디코딩 거부)도 안전한 거부로 본다
for (const path of invalid) cases.push({ group: 'invalid', path, expected: { status: [404, 400] } });
for (const f of manifest.staticFiles) cases.push({ group: 'static', path: encodeURI(f.publicPath), expected: { status: 200 } });
for (const a of manifest.articles)
  for (const f of a.assets) cases.push({ group: 'articleAsset', legacyId: a.legacyId, path: encodeURI(f.publicPath), expected: { status: 200 } });

async function request(method, path) {
  const started = Date.now();
  try {
    const res = await fetch(new URL(path, base), {
      method,
      redirect: 'manual',
      headers: { 'user-agent': 'w0nder-land-baseline-probe/1' },
      signal: AbortSignal.timeout(20000),
    });
    let canonical;
    let titleTag;
    if (method === 'GET' && (res.headers.get('content-type') || '').includes('text/html')) {
      const html = await res.text();
      canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i) || [null])[0];
      titleTag = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [null, null])[1];
    } else {
      await res.arrayBuffer().catch(() => {});
    }
    return {
      status: res.status,
      location: res.headers.get('location'),
      contentType: res.headers.get('content-type'),
      cacheControl: res.headers.get('cache-control'),
      ...(method === 'GET' ? { canonicalTag: canonical ?? null, titleTag: titleTag ?? null } : {}),
      ms: Date.now() - started,
    };
  } catch (e) {
    return { status: null, error: String(e?.cause?.code || e?.name || e), ms: Date.now() - started };
  }
}

const normalizeLocation = loc => {
  if (!loc) return loc;
  try {
    const u = new URL(loc, base);
    return u.origin === new URL(base).origin ? `${u.pathname}${u.search}` : loc;
  } catch {
    return loc;
  }
};

const results = new Array(cases.length);
let cursor = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (cursor < cases.length) {
      const i = cursor++;
      const c = cases[i];
      const [get, head] = await Promise.all([request('GET', c.path), request('HEAD', c.path)]);
      const pass = r =>
        [c.expected.status].flat().includes(r.status) && (c.expected.location === undefined || normalizeLocation(r.location) === c.expected.location);
      results[i] = { ...c, observed: { get, head }, matchesExpected: { get: pass(get), head: pass(head) } };
    }
  }),
);

const failures = results.filter(r => !r.matchesExpected.get || !r.matchesExpected.head);
const summary = {};
for (const r of results) {
  const s = (summary[r.group] ||= { total: 0, getStatus: {}, headStatus: {}, mismatches: 0 });
  s.total += 1;
  s.getStatus[r.observed.get.status] = (s.getStatus[r.observed.get.status] || 0) + 1;
  s.headStatus[r.observed.head.status] = (s.headStatus[r.observed.head.status] || 0) + 1;
  if (!r.matchesExpected.get || !r.matchesExpected.head) s.mismatches += 1;
}

const report = {
  schema: 'URLResponseManifestV1',
  base,
  observedAt: new Date().toISOString(),
  manifestGit: manifest.source.git,
  method: 'fetch GET+HEAD, redirect:manual. 브라우저 클라이언트 이동(router.replace)은 포함하지 않는다.',
  summary,
  failures: failures.map(f => ({ group: f.group, path: f.path, expected: f.expected, get: f.observed.get.status, head: f.observed.head.status, location: f.observed.get.location })),
  results,
};

if (outFile) {
  const full = join(appRoot, outFile);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${outFile}`);
}
console.table(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { total: v.total, GET: JSON.stringify(v.getStatus), HEAD: JSON.stringify(v.headStatus), mismatches: v.mismatches }])));
if (failures.length) {
  console.log(`기대값과 다른 케이스 ${failures.length}개 (처음 15개):`);
  for (const f of report.failures.slice(0, 15)) console.log(`  [${f.group}] ${f.path.slice(0, 90)} → GET ${f.get} HEAD ${f.head} ${f.location ?? ''} (기대 ${JSON.stringify(f.expected)})`);
}
if (expectMode && failures.length) process.exit(1);
