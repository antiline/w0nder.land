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
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCases, loadManifest, matchesExpected } from './cases.mjs';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = loadManifest(appRoot);

const [base, ...rest] = process.argv.slice(2);
if (!base) {
  console.error('usage: probe-urls.mjs <baseUrl> [outFile] [--expect] [--concurrency=N]');
  process.exit(2);
}
const expectMode = rest.includes('--expect');
const outFile = rest.find(a => !a.startsWith('--'));
const concurrency = Number((rest.find(a => a.startsWith('--concurrency=')) || '--concurrency=6').split('=')[1]);

const cases = buildCases(manifest);

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

const results = new Array(cases.length);
let cursor = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (cursor < cases.length) {
      const i = cursor++;
      const c = cases[i];
      const [get, head] = await Promise.all([request('GET', c.path), request('HEAD', c.path)]);
      const pass = r => matchesExpected(c, r.status, r.location, base);
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
  failures: failures.map(f => ({ group: f.group, kind: f.kind, path: f.path, expected: f.expected, get: f.observed.get.status, head: f.observed.head.status, location: f.observed.get.location })),
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
