#!/usr/bin/env node
/**
 * W1 — 기존 원더랜드 콘텐츠·URL·정적 자산의 불변 기준선 manifest 생성기.
 *
 * 원본(public/**)은 읽기만 한다. 결과는 baseline/legacy-content-manifest.json 에 쓴다.
 *   node scripts/baseline/build-manifest.mjs            # 생성
 *   node scripts/baseline/build-manifest.mjs --check    # 현재 소스가 커밋된 manifest 와 같은지 검사 (다르면 exit 1)
 *
 * 경로 규칙은 src/libs/utils/urls.ts · src/repository/posts.ts · src/middleware.ts 의 현행 동작을 그대로 옮긴 것이다.
 * 여기서 규칙을 "개선"하지 않는다. 바뀌면 기준선이 바뀐 것이므로 diff 로 드러나야 한다.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const publicDir = join(appRoot, 'public');
const postsDir = join(publicDir, 'posts');
const outPath = join(appRoot, 'baseline', 'legacy-content-manifest.json');

/** middleware.ts 의 LEGACY_POST_SLUG_PREFIX — 하드코딩 UUID permalink → /posts/1 */
const LEGACY_UUID = '28626b62da0242528bfe5f6873bb32bb';

const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const toPosix = p => p.split(sep).join('/');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    })
    .sort();
}

/** 애니메이션 이미지(animated webp·gif·apng). 시각 비교에서 프레임이 매번 달라 mask 대상이 된다. */
function isAnimatedImage(buf) {
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return buf.includes('ANIM') || buf.includes('ANMF');
  }
  if (buf.subarray(0, 3).toString('latin1') === 'GIF') {
    let frames = 0;
    for (let i = buf.indexOf(Buffer.from([0x21, 0xf9, 0x04])); i !== -1; i = buf.indexOf(Buffer.from([0x21, 0xf9, 0x04]), i + 1)) frames += 1;
    return frames > 1;
  }
  if (buf.subarray(1, 4).toString('latin1') === 'PNG') return buf.includes('acTL');
  return false;
}

function fileRecord(full) {
  const buf = readFileSync(full);
  return {
    publicPath: `/${toPosix(relative(publicDir, full))}`,
    bytes: statSync(full).size,
    sha256: sha256(buf),
    ...(isAnimatedImage(buf) ? { animated: true } : {}),
  };
}

/** 본문에서 참조하는 URL(이미지·영상·링크 미리보기 이미지·마크다운 링크)을 뽑는다. 렌더 결과가 아니라 원문 문자열 기준. */
function extractReferences(markdown) {
  const refs = new Set();
  const patterns = [
    /!\[[^\]]*]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, // ![alt](url "title")
    /\b(?:src|image|poster|href|url)\s*=\s*"([^"]+)"/g, // html 속성 / <link-preview url= image=>
  ];
  for (const re of patterns) {
    for (const m of markdown.matchAll(re)) refs.add(m[1]);
  }
  return [...refs].sort();
}

function gitHead() {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: appRoot }).toString().trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'public'], { cwd: appRoot }).toString().trim();
    return { sha, publicDirDirty: dirty.length > 0 };
  } catch {
    return { sha: null, publicDirDirty: null };
  }
}

function buildArticles() {
  const ids = readdirSync(postsDir).filter(id => existsSync(join(postsDir, id, 'post.md')));
  const strayDirs = readdirSync(postsDir).filter(id => !ids.includes(id));

  const articles = ids.map(id => {
    const mdPath = join(postsDir, id, 'post.md');
    const raw = readFileSync(mdPath);
    const text = raw.toString('utf8');
    const { data, content } = matter(text);
    const frontmatterRaw = text.startsWith('---') ? text.slice(0, text.indexOf('\n---', 3) + 4) : '';

    const title = data.title || '';
    const encodedSlug = `${id}-${encodeURIComponent(title)}`; // urls.ts getPostSlug
    const canonicalPath = `/posts/${encodedSlug}`;
    const assetsDir = join(postsDir, id, 'assets');
    const assets = existsSync(assetsDir) ? walk(assetsDir).map(fileRecord) : [];
    const otherFiles = walk(join(postsDir, id))
      .filter(f => f !== mdPath && !f.startsWith(assetsDir + sep))
      .map(fileRecord);

    const references = extractReferences(content).map(url => {
      if (!url.startsWith('/') || url.startsWith('//')) return { url, kind: 'external' };
      const pathname = url.split(/[?#]/)[0];
      // 확장자가 있는 마지막 세그먼트만 public 파일로 본다. 나머지는 사이트 내부 라우트(/s/…, /posts/…)다.
      if (/\.[a-z0-9]+$/i.test(pathname)) {
        return { url, kind: 'local', existsInPublic: existsSync(join(publicDir, decodeURI(pathname))) };
      }
      return { url, kind: 'internalRoute' };
    });

    return {
      legacyId: id,
      title,
      frontmatter: {
        raw: frontmatterRaw,
        parsed: {
          title: data.title ?? null,
          author: data.author ?? null,
          authorProfile: data.authorProfile ?? null,
          shortUrl: data.shortUrl ?? null,
          category: data.category ?? null,
          keywords: data.keywords ?? null,
          tags: data.tags ?? null,
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        },
        extraKeys: Object.keys(data)
          .filter(k => !['title', 'author', 'authorProfile', 'shortUrl', 'category', 'keywords', 'tags', 'createdAt', 'updatedAt'].includes(k))
          .sort(),
      },
      source: {
        path: toPosix(relative(join(appRoot, '..', '..'), mdPath)),
        bytes: raw.length,
        sha256: sha256(raw),
        bodySha256: sha256(Buffer.from(content, 'utf8')),
      },
      routes: {
        /** sitemap·RSS·latest·/s 리다이렉트가 내보내는 주소. 현행 운영에서는 이 형태가 404 였다(W10). */
        canonicalPath,
        /** 퍼센트 문자를 한 번 더 인코딩한 형태. 현행 운영에서 200 으로 관측됐다(W10). */
        doubleEncodedPath: `/posts/${encodeURIComponent(encodedSlug)}`,
        bareIdPath: `/posts/${id}`,
        shortPath: data.shortUrl ? `/s/${data.shortUrl}` : null,
        rssGuid: id,
      },
      assets,
      otherFiles,
      references,
    };
  });

  // repository/posts.ts getAllPosts 와 같은 정렬 (createdAt 내림차순, 문자열 비교)
  const ordered = [...articles].sort((a, b) =>
    (a.frontmatter.parsed.createdAt || '') > (b.frontmatter.parsed.createdAt || '') ? -1 : 1,
  );
  return { articles: articles.sort((a, b) => Number(a.legacyId) - Number(b.legacyId) || a.legacyId.localeCompare(b.legacyId)), listOrder: ordered.map(a => a.legacyId), strayDirs };
}

function buildIntegrity(articles) {
  const byShort = new Map();
  const byCanonical = new Map();
  for (const a of articles) {
    if (a.routes.shortPath) byShort.set(a.routes.shortPath, [...(byShort.get(a.routes.shortPath) || []), a.legacyId]);
    byCanonical.set(a.routes.canonicalPath, [...(byCanonical.get(a.routes.canonicalPath) || []), a.legacyId]);
  }
  const dup = m => [...m].filter(([, v]) => v.length > 1).map(([k, v]) => ({ path: k, legacyIds: v }));
  return {
    duplicateShortPaths: dup(byShort),
    duplicateCanonicalPaths: dup(byCanonical),
    articlesWithoutShortUrl: articles.filter(a => !a.routes.shortPath).map(a => a.legacyId),
    articlesWithoutTitle: articles.filter(a => !a.title).map(a => a.legacyId),
    idsContainingHyphen: articles.filter(a => a.legacyId.includes('-')).map(a => a.legacyId),
    missingLocalReferences: articles.flatMap(a =>
      a.references.filter(r => r.kind === 'local' && !r.existsInPublic).map(r => ({ legacyId: a.legacyId, url: r.url })),
    ),
    unresolvedInternalRoutes: articles.flatMap(a =>
      a.references
        .filter(r => r.kind === 'internalRoute')
        .filter(r => {
          const p = r.url.split(/[?#]/)[0];
          if (p.startsWith('/s/')) return !articles.some(b => b.routes.shortPath === p);
          const m = p.match(/^\/posts\/([^/-]+)/);
          if (m) return !articles.some(b => b.legacyId === m[1]);
          return !['/', '/posts', '/posts/latest', '/about', '/rss.xml', '/sitemap.xml'].includes(p);
        })
        .map(r => ({ legacyId: a.legacyId, url: r.url })),
    ),
    /** 전 글이 같은 값을 쓰지만 public 에는 .png 만 있다. 현행 화면에서 쓰이는지 여부는 UI 기준선에서 확인한다. */
    missingAuthorProfiles:[...new Set(articles.map(a => a.frontmatter.parsed.authorProfile).filter(Boolean))]
      .filter(p => p.startsWith('/') && !existsSync(join(publicDir, p)))
      .map(p => ({ authorProfile: p, legacyIds: articles.filter(a => a.frontmatter.parsed.authorProfile === p).map(a => a.legacyId) })),
  };
}

function buildSiteRoutes(articles, listOrder) {
  const latestId = listOrder[0];
  const latest = articles.find(a => a.legacyId === latestId);
  return [
    { path: '/', kind: 'page', source: 'src/pages/index.tsx' },
    { path: '/posts', kind: 'page', source: 'src/pages/posts/index.tsx' },
    { path: '/posts/latest', kind: 'redirect', source: 'src/pages/posts/latest.tsx', expectedTarget: latest?.routes.canonicalPath ?? '/posts', note: '최신 글이 바뀌면 대상도 바뀐다' },
    { path: '/about', kind: 'redirect', source: 'next.config.mjs redirects (permanent:false)', expectedTarget: '/' },
    { path: '/rss.xml', kind: 'feed', source: 'src/pages/rss.xml.tsx', note: 'guid=legacyId, date=createdAt, pubDate=요청 시각(변동)' },
    { path: '/sitemap.xml', kind: 'feed', source: 'src/pages/sitemap.xml.tsx', note: 'loc=canonicalPath, lastmod=createdAt' },
    { path: '/robots.txt', kind: 'static', source: 'public/robots.txt' },
    { path: '/api/og/t-001', kind: 'api', source: 'src/pages/api/og/t-001.tsx', expectedStatus: 404, note: 'url 쿼리 없으면 설계상 404' },
    { path: `/api/og/t-001?url=${encodeURIComponent('https://w0nder.land/')}`, kind: 'api', source: 'src/pages/api/og/t-001.tsx', note: '주어진 url 의 HTML 을 가져와 OG 이미지를 만든다' },
    { path: `/posts/${LEGACY_UUID}`, kind: 'redirect', source: 'src/middleware.ts', expectedTarget: '/posts/1' },
    { path: `/posts/${LEGACY_UUID}-legacy-title`, kind: 'redirect', source: 'src/middleware.ts (prefix 일치 시 제목 무관)', expectedTarget: '/posts/1' },
    { path: '/s/__baseline_missing__', kind: 'redirect', source: 'src/pages/s/[slug].tsx (없는 단축 주소)', expectedTarget: '/posts' },
  ];
}

const { articles, listOrder, strayDirs } = buildArticles();
const staticFiles = walk(publicDir)
  .filter(f => !f.startsWith(postsDir + sep))
  .map(fileRecord);

const manifest = {
  schema: 'LegacyContentManifestV1',
  schemaVersion: 1,
  generator: 'src/w0nder-land/scripts/baseline/build-manifest.mjs',
  source: { repo: 'w0nder-official/w0nder.land', git: gitHead() },
  notes: [
    '원본은 읽기 전용으로만 다뤘다. 해시는 디스크 바이트 기준 sha256 이다.',
    'routes 는 소스 규칙에서 파생한 주소다. 실제 HTTP 동작은 baseline/url-observations.*.json 에 따로 기록한다.',
    'canonical <link> 태그는 현재 어떤 페이지에도 없다(src 전체 검색). 이 작업에서 새로 추가하지 않는다.',
  ],
  counts: {
    articles: articles.length,
    articleAssets: articles.reduce((n, a) => n + a.assets.length, 0),
    staticFiles: staticFiles.length,
    derivedArticleRoutes: articles.reduce((n, a) => n + 3 + (a.routes.shortPath ? 1 : 0), 0),
  },
  integrity: { ...buildIntegrity(articles), strayPostDirs: strayDirs },
  listOrder,
  siteRoutes: buildSiteRoutes(articles, listOrder),
  articles,
  staticFiles,
};

// git 상태는 실행 시점마다 다르므로 --check 비교에서 제외한다.
const comparable = m => JSON.stringify({ ...m, source: { ...m.source, git: undefined } });

if (process.argv.includes('--check')) {
  if (!existsSync(outPath)) {
    console.error(`manifest 없음: ${outPath}`);
    process.exit(1);
  }
  const committed = JSON.parse(readFileSync(outPath, 'utf8'));
  if (comparable(committed) !== comparable(manifest)) {
    console.error('기준선과 현재 소스가 다르다. 의도한 변경이면 manifest 를 다시 생성해 diff 를 검토한다.');
    process.exit(1);
  }
  console.log(`OK — ${manifest.counts.articles}개 글, 자산 ${manifest.counts.articleAssets}개, 정적 파일 ${manifest.counts.staticFiles}개가 기준선과 같다.`);
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${relative(appRoot, outPath)}`, manifest.counts, 'integrity:', JSON.stringify(manifest.integrity));
}
