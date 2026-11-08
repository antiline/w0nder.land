import type { Post } from '@/repository/post-types';

export type PostListComparison = {
  equal: boolean;
  /** primary 에만 있는 글 id */
  missing: string[];
  /** shadow 에만 있는 글 id */
  extra: string[];
  /** 같은 id 인데 필드가 다른 글: id → 다른 필드 이름 */
  changed: Record<string, string[]>;
  /** 같은 글 집합인데 목록 순서가 다르다 */
  orderDiffers: boolean;
};

const FIELDS: (keyof Post)[] = [
  'uuid',
  'shortUrl',
  'title',
  'tags',
  'category',
  'author',
  'authorProfile',
  'keywords',
  'createdAt',
  'updatedAt',
  'url',
  'type',
  'article',
];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** 두 원천의 결과를 필드 단위로 비교한다. 응답에는 쓰지 않는다(shadow 비교·전환 게이트용). */
export function comparePostLists(primary: Post[], shadow: Post[]): PostListComparison {
  const byId = new Map(shadow.map(p => [p.uuid, p]));
  const primaryIds = new Set(primary.map(p => p.uuid));
  const missing = primary.filter(p => !byId.has(p.uuid)).map(p => p.uuid);
  const extra = shadow.filter(p => !primaryIds.has(p.uuid)).map(p => p.uuid);
  const changed: Record<string, string[]> = {};
  primary.forEach(p => {
    const other = byId.get(p.uuid);
    if (!other) {
      return;
    }
    const fields = FIELDS.filter(f => !same(p[f], other[f]));
    if (fields.length) {
      changed[p.uuid] = fields;
    }
  });
  const orderDiffers =
    !missing.length && !extra.length && primary.map(p => p.uuid).join() !== shadow.map(p => p.uuid).join();
  return {
    equal: !missing.length && !extra.length && !Object.keys(changed).length && !orderDiffers,
    missing,
    extra,
    changed,
    orderDiffers,
  };
}

/** 로그 한 줄. 본문 내용은 넣지 않는다. */
export function summarizeComparison(c: PostListComparison): string {
  const changed = Object.entries(c.changed)
    .slice(0, 10)
    .map(([id, fields]) => `${id}:${fields.join('+')}`);
  return [
    `missing=${c.missing.length}${c.missing.length ? `(${c.missing.slice(0, 10).join(',')})` : ''}`,
    `extra=${c.extra.length}${c.extra.length ? `(${c.extra.slice(0, 10).join(',')})` : ''}`,
    `changed=${Object.keys(c.changed).length}${changed.length ? `(${changed.join(' ')})` : ''}`,
    `order=${c.orderDiffers ? 'differs' : 'same'}`,
  ].join(' ');
}
