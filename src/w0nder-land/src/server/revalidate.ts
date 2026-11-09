/**
 * 글·홈 정적 페이지의 재생성 주기(초). 원천 설정(POSTS_SOURCE·SITE_PROFILE_SOURCE)과 무관하게 고정한다.
 *
 * 이미지 빌드(Dockerfile)에는 런타임 env 가 없다. 그래서 getStaticProps 는 빌드 때 늘 파일 원천으로 돌고,
 * 그때 돌려준 revalidate 값이 런타임에도 그대로 쓰인다. 원천에 따라 값을 고르면(모코일 때만 60)
 * 빌드 때는 늘 "파일" 이라 재생성이 꺼지고, 런타임에 모코로 바꿔도 빌드 결과(파일 내용)가 계속 나간다.
 *
 * 파일 원천에서 재생성은 같은 파일을 다시 읽어 같은 HTML 을 만든다.
 * 재생성 중 원천이 실패하면 Next 가 이전 페이지를 계속 내보낸다(stale 유지, 오류 페이지로 바꾸지 않음).
 */
export const CONTENT_REVALIDATE_SECONDS = 60;
