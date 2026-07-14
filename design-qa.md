# 대학원장·총동문회 소개 자료 디자인 QA

## 소개 페이지 사진·조직 구조 보정

- `/about/org`, `/about/history`, `/about/class-presidents`의 우측 추상 삽화와 정보 요약 패널을 페이지 의미에 맞는 편집 사진으로 교체했다. 숫자와 지표를 나열하는 패널은 동문회 소개보다 SaaS 홍보 화면처럼 보인다는 사용자 재검토를 반영했다.
- 조직도에는 동문 교류 장면, 연혁에는 서강대학교 정문, 역대 원우회장에는 총동문회가 기증한 알바트로스탑 사진을 사용해 세 화면이 서로 다른 이야기를 갖게 했다.
- 조직도에서 해상도별로 어긋나던 절대 위치 연결선을 제거하고 운영 의사결정·점검과 실행 조직을 명시적인 제목과 카드 그룹으로 구분했다.
- 새 사진 구성은 production build 후 Windows Codex 인앱 브라우저(IAB)의 1440px·768px·390px 화면에서 crop, 이미지 선명도, 텍스트 계층, 수평 overflow를 다시 확인해 통과했다.

## 범위

- 홈 대학원장 인사말 카드
- `/about/dean-greeting`
- `/about/org`
- `/about/class-presidents`
- 헤더·드로어·사이트맵의 소개 메뉴

## 소스와 출처

| 자료 | 출처 | 구현 사용 |
| --- | --- | --- |
| 김도영 경제대학원장 사진 | 사용자 제공 `1-Photo-1.jpg`, 서강대학교 경제대학 교수진 페이지와 인물 일치 확인 | 기존 버건디 배너 구도를 유지한 새 배너 제작 |
| 현행 총동문회 조직도 | 사용자 제공 `2-Photo-2.jpg` | 반응형 HTML 조직 구조로 재구성 |
| 역대 기수별 회장 | `https://econ.sogang.ac.kr/econ/1699/subview.do` | 1–71기 명단과 근무처, 31·33기 미기재 상태 |
| 경제대학원장 인사말 | `https://econ.sogang.ac.kr/econ/1708/subview.do` | 김도영 원장 인사말과 서명 |
| 기존 배너 시각 문법 | `apps/web/public/images/about/greeting-dean-card.png` | 버건디 배경·우측 인물·좌측 카피 구조를 새 자산에 계승한 뒤 구 자산 삭제 |
| 서강대학교 정문·알바트로스탑 | `https://wwwe.sogang.ac.kr/wwwe/campusmap.html` | 연혁·역대 원우회장 상단의 기관 사진 |
| 동문 교류 장면 | 기존 홈 자산 `apps/web/public/images/home/alumni-networking-hero.webp` | 조직도 상단에서 운영 조직의 목적을 사람과 교류 중심으로 표현 |

## 배너 비교

- 기존 배너의 버건디 레이어, 좌측 텍스트 영역, 우측 인물 배치를 유지했다.
- 전임 원장 인물과 우하단 생성형 도구 표식을 제거했다.
- 홈 축약 배너는 총동문회장 카드와 같은 완성형 이미지 문법을 사용한다. 기존 원장 배너를 편집 기준으로 삼아 김도영 원장 인물과 이름을 반영하고 우하단 생성형 도구 표식을 제거한 단일 1200×670 WebP를 제공한다.
- 사용자 제공 실화면에서 확인된 붉은 피부색과 작은 HTML 제목은 사진 위에 별도 그라데이션·카피를 겹친 구현에서 발생했다. 홈 카드는 이미지와 글자를 함께 축소하도록 전환해 피부색·타이포·행갈이·인물 구도가 한 비율로 유지된다.
- 상세 인사말 배너는 장문 페이지의 확대·reflow·스크린리더 품질을 위해 HTML 제목을 유지하되, 그라데이션을 인물보다 앞에서 완전히 투명하게 끝낸다.
- 조직도 설명은 제작 방식 대신 운영진의 역할과 사용자가 확인할 내용을 안내한다.
- 조직도는 `동문회 조직도`를 유일한 H1으로 사용하고, 검색·구간 선택과 Drawer 메뉴에는 명시적인 포커스 및 44px 조작 영역을 적용한다.
- 200% 동등 극소폭에서는 원장 인사 배너의 인물 영역을 숨기고 제목을 전체 폭으로 전환해 한글이 한두 글자씩 분절되지 않게 한다.
- 홈 배너는 총동문회장 카드와 같은 문법으로 인물·카피를 한 이미지에 완성해 함께 축소한다. 상세 인사말 페이지는 별도의 HTML H1과 본문을 유지해 확대·reflow·스크린리더 품질을 보존한다.
- 생성 자산은 1200×670 WebP, 82,382 bytes이며 Next Image optimizer에서 양의 natural size로 렌더됐다.

## 반응형·접근성 검증

| 뷰포트 | 원장 인사말 | 조직도 | 역대 원우회장 |
| --- | --- | --- | --- |
| 1440×1024 | 수평 overflow 없음, 배너·본문 계층 정상 | 연결선 없이 2개 책임 그룹으로 구분 | 2열 명단과 검색·필터 정상 |
| 768×900 | 수평 overflow 없음, 이미지 양의 natural size | 카드 reflow 정상 | 검색·필터와 2열 명단 정상 |
| 390×844 | 배너 358px 폭, 제목·인물 비겹침 | 단일 열 책임 순서, 문서 390/390 | 검색·필터·명단 단일 열, 문서 390/390 |
| 195×422(200% 동등 reflow) | 문서 195/195 | 문서 195/195 | 초협폭에서 명단을 세로 reflow, 문서 195/195 |

- 새 화면의 `main` 안에서 44×44px 미만의 조작 요소가 없음을 확인했다.
- 원우회장 검색창은 키보드 포커스 시 흰색 offset 2px + 브랜드 핑크 4px 링을 표시한다.
- `트라움자원` 검색 시 허민철 47기 1건만 남고 다른 기수는 제거된다.
- 모든 새 이미지가 로드 완료 상태이며 깨진 이미지·0×0 natural size가 없다.
- 비회원 `/auth/session` 401 외 제품 오류는 없으며, 신규 hydration·chunk·CSP 오류는 관측되지 않았다.

## 자동 검증

- `pnpm -C apps/web lint` — PASS
- `pnpm -C apps/web test` — PASS, 54 files / 184 tests
- `pnpm -C apps/web build` — PASS, 신규 세 라우트 포함 39개 정적 페이지 생성
- `git diff --check` — PASS

## Windows Chrome visible E2E

- Chrome 확장 Browser Control의 실제 production 탭에서 1440×900, 390×844, 195×422 동등 reflow를 재검증했다.
- `/about/org`는 `동문회 조직도`를 유일한 H1, `현재 운영진과 역할`을 H2로 제공하고 세 viewport에서 문서 overflow·clipping·heading 겹침이 없었다.
- `/about/class-presidents`의 검색 input과 구간 select는 키보드 이동 후 흰색 2px offset + 브랜드 핑크 4px 포커스 링을 현재 요소에만 표시했고, 이전 요소에 링이 남지 않았다.
- 모바일 Drawer의 `역대 원우회장` 링크는 44px 높이와 포커스 표시를 충족하고 실제 라우트 이동이 정상이다.
- 195×422에서 원장 배너는 text-first 단일 열로 바뀌며 H1 가용 폭이 42px에서 116px로 넓어졌다. 인물 영역을 숨겨 문자 단위 분절·텍스트 겹침·수평 overflow를 제거했다.
- Windows focused 결과는 Blocker 0, Major 0, Minor 0으로 `Windows visible E2E: PASS`, `Design/readability audit: PASS`다.
- Chrome 확장이 `/healthz` 직접 탭 이동을 `ERR_BLOCKED_BY_CLIENT`로 차단한 항목은 제품 장애가 아닌 도구 제약으로 분리했다.

## 소개 페이지 편집 사진 focused IAB QA

- Windows Codex 인앱 브라우저(IAB)에서 1440×900, 768×900, 390×844를 확인했다. 세 화면 모두 Desktop·Tablet에서는 균형 잡힌 2열, Mobile에서는 사진이 본문 아래로 이어지는 단일 열이며 문서 수평 overflow가 없다.
- `/about/org`는 동문 교류 사진을 사용한다. 사진은 운영 조직이 사람과 사업을 연결하는 페이지 목적과 맞고, 본문의 `운영 방향과 점검`·`실행 조직` 의미 그룹과 연결선 없는 구조도 유지됐다.
- `/about/history`는 서강대학교 정문 사진을 사용한다. 실제 표시 크기에서 정문·도로·교정 윤곽을 식별할 수 있고 과도한 흐림이나 픽셀화가 없다.
- `/about/class-presidents`는 알바트로스탑 사진을 사용한다. 탑과 조경의 crop·선명도가 정상이고 연혁 사진 재사용이나 지표형 요약 패널이 없다.
- 페이지 제목과 본문이 이미 충분한 맥락을 제공하므로 사용자 재검토에 따라 세 사진 아래의 설명 캡션은 모두 제거하고 대체 텍스트만 유지한다.
- 세 사진은 모두 `complete=true`, 양의 natural size이며 Next Image optimizer가 HTTP 200을 반환했다. 문구·사진 겹침, 왜곡, 예상 밖 4xx/5xx, Console error/warning, hydration·chunk·CSP·image decode 오류는 없다.
- 원우회장 검색 input과 기수 select는 48px 높이, 연결된 label, 흰색 2px offset + 브랜드 핑크 4px 포커스 링을 유지한다.
- 최종 판정은 Blocker 0, Major 0, Minor 0으로 `About hero 사진 교체 focused production visual QA: PASS`다. 캡처는 `C:\Users\USER\Documents\Codex\2026-07-13\sogecon-about-photo-focused-qa`에 보존했다.

## 사용자 재검토와 인앱 브라우저 경계

- 기존 Windows Chrome 결과는 인물의 표시 여부와 겹침은 확인했지만 피부색 위의 버건디 tint를 놓쳤다. 이 색상 항목에는 해당 PASS를 최종 증거로 재사용하지 않는다.
- 붉은 tint 수정 후 lint, 184개 Web test, production build와 두 대상 route HTTP 200은 다시 통과했다.
- Windows Codex 인앱 브라우저(IAB)에서 1440×900과 390×844를 cache bypass reload로 다시 확인했다. Chrome 확장·외부 Chrome·Playwright CLI·Puppeteer는 사용하지 않았다.
- Desktop에서 총동문회장·대학원장 카드는 각각 664×373.5, Mobile에서는 각각 358.4×201.6으로 같은 비율과 시각적 위계를 유지했다.
- 김도영 원장의 얼굴·안경·상반신은 자연스러운 피부색으로 식별됐고 붉은 overlay, 얼굴·문구 겹침, crop, 깨진 글자, Gemini·제미나이·별표·워터마크, 박정수 문구는 재현되지 않았다.
- 대학원장 카드는 Desktop natural 720×402, Mobile natural 390×217로 로드 완료됐으며 optimizer 응답은 HTTP 200 `image/avif`였다. 카드 클릭 후 `/about/dean-greeting`과 HTML H1도 정상이다.
- IAB Console error/warning, Runtime exception, hydration·chunk·CSP·image decode 오류는 0건이다. `/rum/vitals` beacon 1건의 `net::ERR_FAILED`는 화면·배너와 무관한 telemetry Note로 분리했다.
- Windows IAB 캡처는 실제 JPEG로 저장해 직접 열어 검수했다. 파일 치수는 IAB가 browser inset을 제외한 content bitmap을 반환해 viewport와 차이가 있으며 제품 결함이 아니다.

## 판정

final result: passed

로컬 production 자동 검증과 Windows Codex 인앱 브라우저의 Desktop/Mobile 최종 시각 판정이 모두 통과했다. GitHub 자동 E2E, Windows Chrome visible E2E, Codex 인앱 브라우저 시각 확인은 서로 별도 증거 흐름으로 유지한다.
