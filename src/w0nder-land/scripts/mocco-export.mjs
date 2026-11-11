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
 * - 신규 글은 UUID 폴더와 명시적 고정 주소를 가진 frontmatter로 옮긴다. 기존 이관 글은 바이트 그대로다.
 * - 자산: /v1 은 바이트를 주지 않는다. 모코 manifest(path·sha256)와 로컬 파일을 대조해 없거나 다르면 보고하고 exit 1.
 * - 키·본문은 출력하지 않는다. 글 번호와 개수만 출력한다.
 */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

/** 새 파일과 백업을 모두 준비한 후 교체한다. 교체 도중 실패하면 이미 바꾼 파일도 복구한다. */
function applyWrites(items) {
  if (items.length === 0) {
    return;
  }
  mkdirSync(postsDir, { recursive: true });
  const stage = mkdtempSync(join(postsDir, '.mocco-export-'));
  const prepared = [];
  const published = [];
  let retainRecovery = false;
  try {
    for (const [index, item] of items.entries()) {
      const folder = dirname(item.file);
      if (existsSync(folder) && (!lstatSync(folder).isDirectory() || lstatSync(folder).isSymbolicLink())) {
        throw new Error('글 폴더가 디렉터리가 아니거나 심볼릭 링크다');
      }
      mkdirSync(folder, { recursive: true });
      if (existsSync(item.file) && (!lstatSync(item.file).isFile() || lstatSync(item.file).isSymbolicLink())) {
        throw new Error('글 파일이 일반 파일이 아니다');
      }
      const staged = join(stage, `new-${index}`);
      writeFileSync(staged, item.text);
      const backup = existsSync(item.file) ? join(stage, `old-${index}`) : null;
      if (backup) {
        copyFileSync(item.file, backup);
      }
      prepared.push({ ...item, staged, backup });
    }
    for (const item of prepared) {
      renameSync(item.staged, item.file);
      published.push(item);
    }
  } catch (error) {
    const recoveryErrors = [];
    for (const item of published.reverse()) {
      try {
        if (item.backup) {
          renameSync(item.backup, item.file);
        } else {
          rmSync(item.file, { force: true });
        }
      } catch (recoveryError) {
        recoveryErrors.push(recoveryError);
      }
    }
    if (recoveryErrors.length) {
      retainRecovery = true;
      throw new AggregateError([error, ...recoveryErrors], `복구 실패. 원본 백업을 보존했다: ${stage}`);
    }
    throw error;
  } finally {
    if (!retainRecovery) {
      rmSync(stage, { recursive: true, force: true });
    }
  }
}

/** 신규 글의 메타데이터를 JSON 값으로 인코딩한 YAML에 담는다. 본문 바이트는 바꾸지 않는다. */
function nativeText(d) {
  if (
    !isStr(d.title) ||
    !isStr(d.permalink) ||
    !d.permalink.startsWith('/posts/') ||
    d.permalink === '/posts/' ||
    !isStr(d.firstMadePublicAt) ||
    !Number.isFinite(Date.parse(d.firstMadePublicAt)) ||
    !Array.isArray(d.tags) ||
    !d.tags.every(isStr) ||
    !(d.category === null || isStr(d.category)) ||
    !(d.createdAtText === null || isStr(d.createdAtText)) ||
    !(d.updatedAtText === null || isStr(d.updatedAtText)) ||
    !(
      d.author === null ||
      (d.author && isStr(d.author.displayName) && (d.author.avatar === null || isStr(d.author.avatar)))
    ) ||
    !Array.isArray(d.aliases)
  ) {
    throw new Error(`신규 글의 공개 메타데이터 형식이 틀렸다: ${d.id}`);
  }
  const short = d.aliases.find(a => a.kind === 'short' && isStr(a.path) && /^\/s\/[^/?#]+$/.test(a.path));
  const avatar = d.author?.avatar ?? '';
  const safeAvatar = /^(?:https?:\/\/|\/(?![\/\\]))/.test(avatar) ? avatar : '';
  const data = {
    moccoNative: true,
    moccoPermalink: `/posts/${encodeURIComponent(d.permalink.slice('/posts/'.length))}`,
    title: d.title,
    author: d.author?.displayName ?? '',
    authorProfile: safeAvatar,
    createdAt: d.createdAtText ?? d.firstMadePublicAt,
    updatedAt: d.updatedAtText ?? d.createdAtText ?? d.firstMadePublicAt,
    category: d.category ?? '',
    tags: d.tags,
    keywords: d.tags,
    shortUrl: short?.path.slice('/s/'.length) ?? '',
  };
  return `---\n${Object.entries(data)
    .map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
    .join('\n')}\n---\n${d.bodyMd}`;
}

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
const cursors = new Set();
let cursor = null;
do {
  // eslint-disable-next-line no-await-in-loop -- 커서는 앞 페이지 응답에서만 나온다
  const page = await get(`/v1/blog/posts?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
  if (!Array.isArray(page.items) || !(page.nextCursor === null || isStr(page.nextCursor))) {
    throw new Error('목록 응답 형식이 틀렸다');
  }
  summaries.push(...page.items);
  cursor = page.nextCursor;
  if (cursor && cursors.has(cursor)) {
    throw new Error('목록 페이지 커서가 반복된다');
  }
  if (cursor) {
    cursors.add(cursor);
  }
} while (cursor);

const report = {
  mocco: summaries.length,
  same: [],
  changed: [],
  created: [],
  noLegacyId: [],
  notInMocco: [],
  assetProblems: [],
};
const seen = new Set();
let assetsChecked = 0;
const writes = [];

for (const s of summaries) {
  if (s.status !== 'public') {
    throw new Error('공개가 아닌 글이 목록에 있다');
  }
  const id = s.legacyId ?? s.id;
  const validId = s.legacyId === null ? /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id) : /^\d+$/.test(id);
  if (!validId || seen.has(id)) {
    throw new Error('글 폴더 ID가 유효하지 않거나 겹친다');
  }
  seen.add(id);
  // eslint-disable-next-line no-await-in-loop -- 82개 정도라 순서대로 읽는다(모코 부하를 늘리지 않는다)
  const d = await get(`/v1/blog/posts/${encodeURIComponent(s.id)}`);
  if (d.id !== s.id || d.legacyId !== s.legacyId || d.status !== 'public' || !isStr(d.bodyMd)) {
    throw new Error(`상세 응답이 목록과 맞지 않거나 형식이 틀렸다: ${s.legacyId}`);
  }
  if (!(d.frontmatter === null || isStr(d.frontmatter))) {
    throw new Error(`frontmatter 형식이 틀렸다: ${s.legacyId}`);
  }
  if (s.legacyId !== null && d.frontmatter === null) {
    throw new Error(`이관 글의 frontmatter가 없다: ${id}`);
  }
  const text = Buffer.from(s.legacyId === null ? nativeText(d) : `${d.frontmatter}${d.bodyMd}`, 'utf8');
  const file = join(postsDir, id, 'post.md');
  if (!existsSync(file)) {
    report.created.push(id);
  } else if (sha(readFileSync(file)) === sha(text)) {
    report.same.push(id);
  } else {
    report.changed.push(id);
  }
  if (!report.same.includes(id)) {
    writes.push({ file, text });
  }
  for (const a of Array.isArray(d.assets) ? d.assets : []) {
    assetsChecked += 1;
    const local = assetFile(id, a.path);
    if (!existsSync(local)) {
      report.assetProblems.push(`${id}:${a.path}:없음`);
    } else if (sha(readFileSync(local)) !== a.sha256) {
      report.assetProblems.push(`${id}:${a.path}:해시다름`);
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
// 전부 읽고 자산도 검사한 뒤에만 쓴다. 중간 실패가 부분 롤백 파일을 남기지 않게 한다.
if (write && blocking === 0 && report.notInMocco.length === 0) {
  applyWrites(writes);
}
const pending = write ? 0 : report.changed.length + report.created.length;
process.exit(blocking + pending + report.notInMocco.length > 0 ? 1 : 0);
