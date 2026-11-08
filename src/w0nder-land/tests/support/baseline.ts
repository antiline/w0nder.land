// scripts/baseline 의 manifest·케이스 정의를 테스트에서 그대로 쓴다. 정의를 두 곳에 두지 않는다.
import { join } from 'node:path';
// eslint-disable-next-line import/extensions
import { buildCases, loadManifest, matchesExpected, normalizeLocation } from '../../scripts/baseline/cases.mjs';

export type UrlCase = {
  path: string;
  group: string;
  kind: 'contract' | 'characterization';
  legacyId?: string;
  fixedBy?: string;
  expected: { status: number | number[]; location?: string };
};

export type ManifestArticle = {
  legacyId: string;
  title: string;
  routes: { canonicalPath: string; doubleEncodedPath: string; bareIdPath: string; shortPath: string | null };
  assets: { publicPath: string; animated?: boolean }[];
  references: { url: string; kind: string }[];
};

export type Manifest = {
  listOrder: string[];
  articles: ManifestArticle[];
};

export const manifest = loadManifest(join(__dirname, '..', '..')) as Manifest;
export const urlCases = buildCases(manifest) as UrlCase[];
export const isExpected = matchesExpected as (
  c: UrlCase,
  status: number,
  location: string | undefined,
  base: string,
) => boolean;
export const toPath = normalizeLocation as (location: string | undefined, base: string) => string | undefined;

/** 프레임이 매번 달라지는 애니메이션 이미지의 원본 경로 */
export const animatedImagePaths = (): string[] =>
  manifest.articles.flatMap(a => a.assets.filter(f => f.animated).map(f => f.publicPath));

export const article = (id: string) => {
  const found = manifest.articles.find(a => a.legacyId === id);
  if (!found) {
    throw new Error(`manifest 에 글 ${id} 없음`);
  }
  return found;
};
