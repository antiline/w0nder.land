/**
 * 공개 페이지가 글을 읽는 경계(W3, #8). getStaticProps·getServerSideProps 에서만 import 한다.
 * 이 모듈과 하위 모듈은 서버 전용 값(모코 read key)을 다루므로 컴포넌트에서 import 하지 않는다.
 *
 * - POSTS_SOURCE=file (기본): 저장소의 public/posts 를 읽는다. 지금 운영과 같다.
 * - POSTS_SOURCE=mocco: 모코 /v1 blog 읽기 API. 실패하면 오류를 던진다. 파일로 몰래 대체하지 않는다.
 * - POSTS_SHADOW=mocco: 응답은 파일에서 만들고, 모코 결과를 나란히 읽어 차이만 로그로 남긴다.
 */
import type { PostReader } from '@/server/post-reader-port';
import { FilePostReader } from '@/server/file-post-reader';
import { ShadowPostReader } from '@/server/shadow-post-reader';
import { MoccoPostReader, moccoConfigFromEnv } from '@/server/mocco-post-reader';

export type { PostReader } from '@/server/post-reader-port';
export { FilePostReader } from '@/server/file-post-reader';
export { ShadowPostReader } from '@/server/shadow-post-reader';

let reader: PostReader | undefined;

export function postReaderFromEnv(env: NodeJS.ProcessEnv = process.env): PostReader {
  const source = env.POSTS_SOURCE ?? 'file';
  const shadow = env.POSTS_SHADOW;
  if (source !== 'file' && source !== 'mocco') {
    throw new Error(`POSTS_SOURCE 값이 잘못됐다: ${source}`);
  }
  if (shadow && shadow !== 'mocco') {
    throw new Error(`POSTS_SHADOW 값이 잘못됐다: ${shadow}`);
  }
  if (source === 'mocco' && shadow) {
    throw new Error('POSTS_SOURCE=mocco 에서는 POSTS_SHADOW 를 쓰지 않는다');
  }

  if (source === 'mocco') {
    return new MoccoPostReader(moccoConfigFromEnv(env));
  }
  const file = new FilePostReader();
  return shadow ? new ShadowPostReader(file, new MoccoPostReader(moccoConfigFromEnv(env))) : file;
}

/** 프로세스당 하나. 페이지 코드는 이것만 쓴다. */
export function postReader(): PostReader {
  reader ??= postReaderFromEnv();
  return reader;
}
