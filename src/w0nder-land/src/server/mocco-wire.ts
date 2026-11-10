/**
 * 모코 /v1/blog 응답 중 원더랜드가 쓰는 필드의 모양(서버 전용). 받은 JSON 은 쓰기 전에 여기서 검사한다.
 *
 * 형식이 틀린 응답(필드 없음·타입 다름)을 그대로 쓰면 오류 없이 엉뚱한 화면이 나가고,
 * ISR 은 "성공"으로 보고 이전 페이지를 덮어쓴다(W9 리허설에서 본문이 숫자 123 으로 나간 사례).
 * 그래서 틀린 응답은 MoccoReadError 로 바꿔 전체 실패로 다룬다. 쓰지 않는 필드는 검사하지 않고 버린다.
 */
import { z } from 'zod';
import { MoccoReadError } from '@/server/mocco-read-error';

export const moccoPostSummarySchema = z.object({
  id: z.string().min(1),
  legacyId: z.string().nullable(),
  // 공개가 아닌 글은 형식 오류가 아니라 계약 위반이라 따로 거부한다(mocco-post-reader).
  status: z.string(),
});

export const moccoPostListSchema = z.object({
  items: z.array(moccoPostSummarySchema),
  nextCursor: z.string().min(1).nullable(),
});

export const moccoPostDetailSchema = moccoPostSummarySchema.extend({
  /** 디코딩된 경로(예: `/posts/12-한글 제목`). */
  permalink: z.string(),
  /** 원문 frontmatter(구분선 포함) 또는 null. */
  frontmatter: z.string().nullable(),
  bodyMd: z.string(),
  title: z.string().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  createdAtText: z.string().nullable().optional(),
  updatedAtText: z.string().nullable().optional(),
  firstMadePublicAt: z.string().datetime().optional(),
  author: z.object({ displayName: z.string(), avatar: z.string().nullable() }).nullable().optional(),
  aliases: z.array(z.object({ path: z.string(), kind: z.string() })).optional(),
});

/** 이관 파일이 없는 신규 글에는 /v1 공개 메타데이터가 반드시 있어야 한다. */
export const moccoNativePostSchema = moccoPostDetailSchema.extend({
  id: z.string().uuid(),
  legacyId: z.null(),
  title: z.string().min(1),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  createdAtText: z.string().nullable(),
  updatedAtText: z.string().nullable(),
  firstMadePublicAt: z.string().datetime(),
  author: z.object({ displayName: z.string(), avatar: z.string().nullable() }).nullable(),
  aliases: z.array(z.object({ path: z.string(), kind: z.string() })),
});

export const moccoLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
  key: z.string().nullish(),
  kind: z.enum(['social', 'link']).nullish(),
  description: z.string().nullish(),
});

export const moccoSiteSchema = z.object({
  name: z.string(),
  description: z.string(),
  links: z.array(moccoLinkSchema),
  authors: z.array(
    z.object({
      displayName: z.string(),
      bio: z.string(),
      avatar: z.string().nullable(),
      links: z.array(moccoLinkSchema),
    }),
  ),
});

export type MoccoPostSummary = z.infer<typeof moccoPostSummarySchema>;
export type MoccoPostDetail = z.infer<typeof moccoPostDetailSchema>;
export type MoccoLink = z.infer<typeof moccoLinkSchema>;
export type MoccoSite = z.infer<typeof moccoSiteSchema>;

/** 검사 실패는 어느 응답의 어느 필드인지만 남긴다(값은 로그에 남기지 않는다). */
export function parseWire<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const where = result.error.issues
      .slice(0, 3)
      .map(i => `${i.path.join('.') || '(root)'}: ${i.code}`)
      .join(', ');
    throw new MoccoReadError(`${what} 응답 형식이 틀렸다 — ${where}`);
  }
  return result.data;
}
