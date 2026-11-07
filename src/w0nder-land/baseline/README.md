# 기존 원더랜드 불변 기준선 (W1)

원더랜드 내부를 개편하더라도 **공개 UI, 기존 글 데이터, 모든 URL**은 바뀌면 안 된다. 이 폴더는 그 기준을 기계가 비교할 수 있는 형태로 고정한다.
관련 이슈: [#6 W1](https://github.com/w0nder-official/w0nder.land/issues/6), [#15 W10](https://github.com/w0nder-official/w0nder.land/issues/15), 에픽 [#5](https://github.com/w0nder-official/w0nder.land/issues/5).

## 파일

| 파일 | 내용 | 만드는 방법 |
|---|---|---|
| `legacy-content-manifest.json` | 글 82개의 frontmatter 원문·파싱값, `post.md` 바이트 sha256, 본문 sha256, 글별 자산과 기타 정적 파일 18개의 sha256, 소스 규칙에서 파생한 주소(정식·이중 인코딩·bare ID·단축·RSS guid), 목록 정렬 순서, 사이트 라우트, 무결성 점검 결과 | `node scripts/baseline/build-manifest.mjs` |
| `url-observations.production.json` | 위 주소 전부와 무효 입력에 대한 운영 서버의 GET·HEAD 상태, Location, Content-Type, Cache-Control, canonical 태그 유무 | `node scripts/baseline/probe-urls.mjs https://w0nder.land baseline/url-observations.production.json` |

원본(`public/**`)이 기준선과 같은지 확인하려면 다음을 실행한다. 다르면 exit 1로 끝난다. 의도한 변경이었다면 manifest를 다시 생성하고 diff를 리뷰한다.

```sh
node scripts/baseline/build-manifest.mjs --check
```

URL 동작을 기대값과 비교하려면 `--expect`를 붙인다. 기대값과 다른 케이스가 있으면 exit 1로 끝난다.

```sh
node scripts/baseline/probe-urls.mjs http://localhost:3000 --expect
```

## 관측과 기대를 나눈다

`url-observations.*.json`의 `observed`에는 관측 당시 실제로 받은 응답이 들어 있다. `expected`에는 보존하거나 복구해야 할 정상 동작이 들어 있다. 기존의 결함을 "보존할 동작"으로 고정하지 않기 위해 둘을 분리했다.

| 주소 종류 | 기대 | 2026-11-07 운영 관측 |
|---|---|---|
| 정식 주소 `/posts/{id}-{encodeURIComponent(title)}` (사이트맵·RSS·목록 링크·`/s/*`·`/posts/latest`가 가리키는 주소) | 200 | **82개 모두 404 (GET·HEAD)** → W10 |
| 같은 주소에 쿼리 추가 | 200 | 82개 모두 404 |
| 이중 인코딩 주소 `/posts/{id}-{encodeURIComponent(encodeURIComponent(title))}` | 200 (legacy alias 유지) | 82개 모두 200 |
| bare ID `/posts/{id}` | 200 | HTTP 200. 다만 브라우저에서는 `router.replace`가 정식 주소로 바꾼 뒤 404 화면이 뜬다 |
| 단축 `/s/{shortUrl}` | 307 → 정식 주소 | 82개 모두 307 (도착지는 404) |
| `/posts/latest` | 307 → 최신 글 정식 주소 | 307 (도착지는 404) |
| `/about` | 307 → `/` | 307 |
| 하드코딩 UUID `/posts/28626b62…`와 그 prefix | 307 → `/posts/1` | 307 |
| 없는 단축 주소 `/s/…` | 307 → `/posts` | 307 |
| 잘못된 제목, 없는 ID, 깨진 퍼센트 인코딩, 경로 이동 시도, 삼중 인코딩 | 404 또는 400 | 404 6건, 400 1건(깨진 인코딩) |
| `/api/og/t-001` | `url` 쿼리 없으면 404, 있으면 200 PNG | 같음 |
| 정적 파일 18개, 글 자산 32개 | 200 | 모두 200 |

브라우저 관측(agent-browser, 운영, 2026-11-07): `/posts` 목록에서 글을 클릭하면 정식 주소로 이동하고 404 화면이 뜬다. `/posts/1`, `/s/epilogue`, `/posts/latest`도 최종적으로 404 화면이다. 즉 관측 시점에 **브라우저로는 어떤 글도 읽을 수 없었다.** 정식 주소 404는 기존에 있던 오류이며 보존할 동작이 아니다.

## 화면 기준선

- 대상: 홈 `/`, 목록 `/posts`, 상세 1개(정식 주소가 404라서 이중 인코딩 주소로 캡처)
- 크기: PC 1440×900, 모바일 390×844, full-page 스크린샷
- 캡처본은 저장소가 아니라 작업자 비공개 기록에 보관한다(바이너리를 공개 저장소에 쌓지 않는다). 재캡처할 때는 환경, SHA, 시각을 함께 남긴다.
- 비교할 때 제외하는 변동 요소:
  - AdSense 슬롯(`AdSenseAd`): 홈의 흰 박스 2개, 목록과 상세의 광고 영역. 크기와 위치만 비교하고 내용은 비교하지 않는다.
  - 외부 임베드: 글 5의 트위터 임베드, `<link-preview>`의 외부 이미지
  - 푸터의 연도(`© {현재 연도}`), RSS `pubDate`(요청 시각)

## 무결성 점검에서 나온 사실

- 글 82개, 폴더 ID에 하이픈 없음, 정식 주소·단축 주소 중복 없음, 본문의 로컬 파일 참조와 내부 링크 중 깨진 것 없음
- 82개 글 전부 `authorProfile: /images/profile_image.jpg`인데 `public`에는 `.png`만 있다. 현재 UI 코드는 이 필드를 화면에 쓰지 않는다. DTO 필드라서 값은 그대로 보존한다.
- `rel="canonical"` 태그는 어느 페이지에도 없다. 이 작업에서 새로 추가하지 않는다(SEO 개선은 별도 이슈).

## 한계

- 클라이언트 이동은 표본(목록 클릭, bare, short, latest)만 브라우저로 확인했다. 82개 전체를 확인하지는 않았다.
- 시각 비교 자동화(픽셀 diff)와 테스트 러너 도입은 W2 범위다.
- 관측 시점 운영 응답에는 Vercel 헤더가 없다. PR #4(2026-11-05)의 셀프호스팅 배포로 서빙되는 것으로 보인다. 그 이전 Vercel 시기의 동작은 이 기준선과 비교할 수 없다.
