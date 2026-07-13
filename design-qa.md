# Issue #237 인증 여정 디자인 QA

## 비교 대상

- source visual truth: `/mnt/c/Users/USER/Documents/Codex/2026-07-11/chrome-browser-control-sogecon-app-pr/design-qa-auth-237/source-option-2.png`
- implementation top: `/mnt/c/Users/USER/Documents/Codex/2026-07-11/chrome-browser-control-sogecon-app-pr/design-qa-auth-237/implementation-signup-mobile.jpg`
- implementation lower: `/mnt/c/Users/USER/Documents/Codex/2026-07-11/chrome-browser-control-sogecon-app-pr/design-qa-auth-237/implementation-signup-mobile-lower.jpg`
- full-view comparison: `/mnt/c/Users/USER/Documents/Codex/2026-07-11/chrome-browser-control-sogecon-app-pr/design-qa-auth-237/comparison-source-vs-implementation-mobile.jpg`
- route: `http://localhost:3000/signup`
- viewport: `390×844`
- state: 로그아웃, 빈 가입 폼, 선택 메모 접힘, 제출 전
- browser: Windows Chrome 확장 Browser Control production runtime

## 전체 화면 비교

- 공식 서강대학교 로고, burgundy·warm white·navy 토큰, KoPub·Pretendard 계층을 유지했다.
- source의 `진행 단계 → 제목 → 동문 확인 정보 → 연락 정보 → 제출 행동` 순서를 구현에서도 보존했다.
- 실제 제품 계약에 필요한 6개 필수·핵심 입력은 source보다 많지만 모바일 inline label과 접힌 선택 메모로 밀도를 조정했다.
- 최종 구현의 제출 CTA는 `docY=1008.8px`로, 수용 기준 `1025px 이하`를 충족한다.
- 문서는 `clientWidth=375`, `scrollWidth=375`로 수평 overflow가 없다.

## 집중 비교

별도 crop은 만들지 않았다. 390×844 top/lower 캡처에서 진행 단계, 입력 행, 접힌 선택 메모, 제출 CTA가 판독 가능했고, Windows Chrome에서 각 영역의 DOM rect를 직접 실측해 같은 상태의 full-view 비교를 보완했다.

- 진행 안내: `docY=154.4`, `309.6×92`
- 제목: `docY=291.2`, `343.2×40`
- 첫 입력: `docY=463.2`, `239.2×44`
- 필수 core input 6개: 모두 높이 `44px`
- 선택 메모 summary: `docY=892`, `317.6×44`, `open=false`
- 제출 CTA: `docY=1008.8`, `343.2×48`
- 보조 행동: `docY=1068.8`, `343.2×44`
- 모바일 메뉴: `44×44`

## 필수 fidelity surface

- fonts and typography: source와 같은 공식 로고·한글 중심 hierarchy를 유지하고, H1과 section heading의 크기·무게 차이가 명확하다.
- spacing and layout rhythm: 첫 구현의 과도한 세로 적층을 inline field와 접힘 선택 영역으로 줄여 source의 compact editorial rhythm에 근접했다.
- colors and tokens: 기존 브랜드 burgundy, warm surface, navy text, neutral border 토큰을 재사용했다.
- image quality and asset fidelity: 기존 공식 로고 asset을 Next Image로 유지했으며 placeholder·대체 drawing을 추가하지 않았다.
- copy and content: 내부 구현 용어 없이 `정보 보내기 → 사무국 확인 → 비밀번호 만들기`와 두 정보 그룹, 다음 행동을 한국어로 설명한다.

## 비교 이력

### 1차 — blocked

- finding P2: 모바일 가입 CTA가 `docY=1389.59px`, 문서 높이가 `1742px`로 source보다 지나치게 아래에 있었다.
- fix: 모바일 설명과 card padding을 줄이고 label/input을 compact inline row로 바꾸며, 선택 메모를 기본 접힘 영역으로 이동했다.
- post-fix evidence: CTA `docY=1008.8px`, 문서 높이 `1341px`, 선택 메모 접힘, core input 6개 높이 `44px`.

### 2차 — blocked

- finding P2: 공통 header 홈 링크 높이 `31.25px`, footer 지원 링크 높이 `15.99px`로 44px 조작 계약에 미달했다.
- fix: header home anchor에 `min-h-11`, footer anchors에 `inline-flex min-h-11 min-w-11`을 적용했다.
- post-fix evidence:
  - header 홈: `249.99×44`
  - 자주 묻는 질문: `68.25×44`
  - 문의하기: `44×44`
  - 이용약관: `44×44`
  - 개인정보처리방침: `82.97×44`

### 3차 — passed

- P0: 없음
- P1: 없음
- P2: 없음
- P3: 없음
- console error/warning: 0
- hydration/chunk/CSP 오류: 0
- 입력 제출·POST·DB 변경: 0

### PR #238 리뷰 수정 — passed

- 가입 API 오류를 synthetic POST 422로 재현하고 실제 API·DB 전달 없이 검증했다.
- 오류 banner가 `role=alert`, `tabIndex=-1`과 실제 포커스를 받았고 `343.2×57.6` rect 전체가 viewport에 표시됐다.
- 로컬 기수 오류로 전환하면 이전 API banner가 제거되고 기수 입력에 포커스·`aria-invalid`·연결된 오류만 남았다.
- 선택 메모는 기본 접힘·summary `44px`, 로그인 문의 링크는 `44px`를 유지했다.
- Desktop 로그인 보조 카드 2개는 각각 `282×80`, `flex-direction: column`, `align-items: flex-start`로 렌더됐다.
- Desktop header overflow·control 교차 0, console error/warning 0, 예상 밖 4xx/5xx 0.

## Findings

수용을 막는 시각·반응형·접근성 차이는 남아 있지 않다.

## Open Questions

- source가 표현하지 않은 가입 완료·오류 상태는 제품 계약에 따른 합리적 확장으로 분리했으며 자동화 테스트와 기존 인증 흐름 감사 근거로 검증한다.

## Implementation Checklist

- [x] 3단계 가입 여정 hierarchy
- [x] 모바일 compact 필수 정보 흐름
- [x] 선택 메모 기본 접힘
- [x] CTA 접근 거리 기준 충족
- [x] 입력·버튼·보조 행동·header/footer 44px 조작 영역
- [x] 수평 overflow 없음
- [x] production Windows Chrome console 안정성

## Follow-up Polish

- 없음.

final result: passed
