#!/usr/bin/env node
/**
 * W9(#14) 롤백 준비 — 모코 /v1/blog 의 공개 글을 저장소 public/posts 와 대조하고, 필요하면 되돌려 쓴다.
 *
 * 정본을 모코로 바꾼 뒤 파일 원천(POSTS_SOURCE=file)으로 돌아가려면, 그 사이 모코에서 생긴 수정·새 글을
 * 먼저 파일로 옮겨야 한다. 그렇지 않으면 되돌리는 순간 그 내용이 사라진다.
 *
 *   MOCCO_API_URL=… MOCCO_BLOG_READ_KEY=… node scripts/mocco-export.mjs            # 대조만(기본). 차이가 있으면 exit 1
 *   MOCCO_API_URL=… MOCCO_BLOG_READ_KEY=… node scripts/mocco-export.mjs --write    # 바뀐 글·새 글을 쓴다
 *   … --dir=<경로>   # 기본은 이 앱의 public/posts
 *
 * 규칙
 * - post.md = frontmatter + bodyMd. 모코는 이관 때 원문을 바이트 그대로 나눠 저장했으므로 sha256 으로 대조한다.
 * - 파일은 지우지 않는다. 모코에 없는 파일 글은 보고만 한다(비공개 전환일 수도, 사고일 수도 있어 사람이 판단).
 * - legacyId 없는 새 글은 파일 원천에 주소 규칙이 없어 되돌릴 수 없다. 보고하고 exit 1.
 * - 자산: /v1 은 바이트를 주지 않는다. 모코 manifest(path·sha256)와 로컬 파일을 대조해 없거나 다르면 보고하고 exit 1.
 * - 키·본문은 출력하지 않는다. 글 번호와 개수만 출력한다.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const write = args.includes('--write');
const postsDir = (args.find(a => a.startsWith('--dir=')) ?? `--dir=${join(appRoot, 'public', 'posts')}`).slice(6);
const base = (process.env.MOCCO_API_URL ?? '').replace(/\/$/, '');
const key = process.env.MOCCO_BLOG_READ_KEY;
if (!base || !key) {
  console.error('MOCCO_API_URL 과 MOCCO_BLOG_READ_KEY 가 필요하다');
  process.exit(2);
}

const sha = buf => createHash('sha256').update(buf).digest('hex');
const isStr = v => typeof v === 'string';

async function get(path) {
  const res = await fetch(base + path, {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}`);
  }
  return res.json();
}

/** 글 폴더 밖으로 나가는 경로(.., 절대경로)는 거부한다. */
function inside(root, rel) {
  const target = normalize(join(root, rel));
  if (!target.startsWith(root + sep)) {
    throw new Error(`글 폴더 밖 경로: ${rel}`);
  }
  return target;
}

/** 모코 자산 path 는 `assets/x.jpg`(글 기준) 또는 `/posts/1/assets/x.jpg`(사이트 기준)일 수 있다. */
function assetFile(legacyId, path) {
  const publicRoot = dirname(postsDir);
  return path.startsWith('/') ? inside(publicRoot, path.slice(1)) : inside(join(postsDir, legacyId), path);
}

const summaries = [];
let cursor = null;
do {
  // eslint-disable-next-line no-await-in-loop -- 커서는 앞 페이지 응답에서만 나온다
  const page = await get(`/v1/blog/posts?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
  if (!Array.isArray(page.items) || !(page.nextCursor === null || isStr(page.nextCursor))) {
    throw new Error('목록 응답 형식이 틀렸다');
  }
  summaries.push(...page.items);
  cursor = page.nextCursor;
} while (cursor);

const report = { mocco: summaries.length, same: [], changed: [], created: [], noLegacyId: [], notInMocco: [], assetProblems: [] };
const seen = new Set();
let assetsChecked = 0;

for (const s of summaries) {
  if (!s.legacyId) {
    report.noLegacyId.push(s.id);
    continue;
  }
  if (!/^\d+$/.test(s.legacyId) || seen.has(s.legacyId)) {
    throw new Error(`legacyId 가 숫자가 아니거나 겹친다: ${s.legacyId}`);
  }
  seen.add(s.legacyId);
  // eslint-disable-next-line no-await-in-loop -- 82개 정도라 순서대로 읽는다(모코 부하를 늘리지 않는다)
  const d = await get(`/v1/blog/posts/${encodeURIComponent(s.id)}`);
  if (d.id !== s.id || d.legacyId !== s.legacyId || d.status !== 'public' || !isStr(d.bodyMd)) {
    throw new Error(`상세 응답이 목록과 맞지 않거나 형식이 틀렸다: ${s.legacyId}`);
  }
  if (!(d.frontmatter === null || isStr(d.frontmatter))) {
    throw new Error(`frontmatter 형식이 틀렸다: ${s.legacyId}`);
  }
  const text = Buffer.from(`${d.frontmatter ?? ''}${d.bodyMd}`, 'utf8');
  const file = join(postsDir, s.legacyId, 'post.md');
  if (!existsSync(file)) {
    report.created.push(s.legacyId);
  } else if (sha(readFileSync(file)) === sha(text)) {
    report.same.push(s.legacyId);
  } else {
    report.changed.push(s.legacyId);
  }
  if (write && !report.same.includes(s.legacyId)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  for (const a of Array.isArray(d.assets) ? d.assets : []) {
    assetsChecked += 1;
    const local = assetFile(s.legacyId, a.path);
    if (!existsSync(local)) {
      report.assetProblems.push(`${s.legacyId}:${a.path}:없음`);
    } else if (sha(readFileSync(local)) !== a.sha256) {
      report.assetProblems.push(`${s.legacyId}:${a.path}:해시다름`);
    }
  }
}

if (existsSync(postsDir)) {
  report.notInMocco = readdirSync(postsDir).filter(id => existsSync(join(postsDir, id, 'post.md')) && !seen.has(id));
}

const counts = Object.fromEntries(Object.entries(report).map(([k, v]) => [k, Array.isArray(v) ? v.length : v]));
console.log(JSON.stringify({ mode: write ? 'write' : 'check', ...counts, assetsChecked }));
for (const k of ['changed', 'created', 'noLegacyId', 'notInMocco', 'assetProblems']) {
  if (report[k].length) {
    console.log(`${k}: ${report[k].join(', ')}`);
  }
}

const blocking = report.noLegacyId.length + report.assetProblems.length;
const pending = write ? 0 : report.changed.length + report.created.length;
process.exit(blocking + pending + report.notInMocco.length > 0 ? 1 : 0);
