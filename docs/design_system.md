# 동문회 디자인 시스템 v1.1

본 문서는 웹 애플리케이션의 UI/UX 일관성, 접근성, 성능 기준을 수립하는 SSOT입니다. 모든 화면/컴포넌트는 이 문서의 원칙과 토큰을 우선 적용합니다.

## 1) 목적/범위
- 목적: 모바일 우선 가독성, 상호작용 일관성, 유지보수성 향상.
- 범위: 디자인 토큰(Tailwind 기반), 타이포/간격, 컴포넌트(버튼/입력/탭/배지/카드/레이아웃), 접근성/성능 가이드.
- 비범위: 브랜드 리브랜딩(로고/팔레트 전면 교체), 다국어, 고급 애니메이션.

## 2) 디자인 원칙
- 모바일 우선(Mobile-first): 작은 화면에서 정보 우선순위를 명확히.
- 명확성(Clarity): 대비(AA 이상), 충분한 여백, 단순한 상호작용.
- 일관성(Consistency): 동일 의미=동일 패턴/토큰 사용.
- 접근성(Accessibility): 키보드/스크린리더 호환, 의미론적 마크업.
- 성능(Performance): 불필요한 자산/렌더링 최소화, LCP/CLS 관리.

## 3) 토큰(Token)
Tailwind CSS 4 설정(`apps/web/app/globals.css`의 `@theme`)에서 semantic 레이어로 정의합니다.

토큰의 단일 소유자는 `apps/web/app/styles/tailwind-theme.css`입니다. `globals.css`는 Tailwind·theme·component utility를 불러오고 body, main, 전역 focus처럼 문서 전체에 필요한 규칙만 담당합니다. 화면별 조합은 JSX의 utility class 또는 `component-utilities.css`에 둡니다.

### 3.1 색상(semantic)
- brand: 50/100/200/300/400/500/600/700/800/900
- text: primary, secondary, muted, inverse
- surface: default, raised, sunken
- state: primary, secondary, success, info, warning, error
- 링크/포커스 링/배경 대비는 AA 이상을 유지합니다.

### 3.2 간격/레이아웃
- spacing scale: 4/8/12/16/24/32/40/48(px 기준)
- container: `sm:px-4 md:px-6 lg:px-8`, max-width는 페이지 성격에 맞게 단계별 적용
- radius: sm(4), md(8), lg(12)
- shadow: xs/sm/md/lg(깊이 단계)

### 3.3 타이포그래피
- 본문(base): 14–16px, line-height 1.5–1.7
- 헤딩: h1(28–32), h2(22–24), h3(18–20) — 모바일 기준, md 이상에서 점진 확대
- 링크: hover/active/visited 상태 토큰 일관 적용

### 3.4 검증 뷰포트와 브레이크포인트
- 390px: 모바일 기준. 한 열, 가로 스크롤 없이 핵심 행동을 우선합니다.
- 768px: 태블릿 전환점(`md`). 밀도보다 읽기 순서와 터치 조작을 보존합니다.
- 1024px: 데스크톱 내비게이션 전환점(`lg`).
- 1440px: 넓은 데스크톱 기준. 본문은 `max-width: 72rem` 안에서 과도하게 늘어나지 않습니다.
- 구현에는 Tailwind 기본 breakpoint를 사용하고, Windows visual E2E는 위 네 폭을 고정 회귀 기준으로 사용합니다.

## 4) 컴포넌트 가이드
각 컴포넌트는 a11y 속성, 상태(기본/hover/active/disabled/error), 크기(sm/md/lg)를 제공합니다.

### 4.1 Button
- 변형: primary/secondary/ghost/danger
- 상태: loading/disabled
- a11y: aria-busy, 명확한 라벨, 키보드 포커스 링
- `sm`, `md`, `lg` 모두 최소 44×44px입니다. 크기 이름은 글자와 여백의 밀도를 뜻하며 터치 목표를 줄이지 않습니다.

### 4.2 Input/Select/TextArea
- 라벨/헬프/에러 텍스트 연결: `id`/`htmlFor`, `aria-describedby`
- 모바일 키패드: `inputMode`/`autoComplete`
- 에러: 색상+아이콘(선택), `aria-invalid=true`
- 모든 필드는 최소 44px 높이를 유지합니다. helper와 error가 함께 있으면 둘 다 DOM에 남기고 `aria-describedby`로 연결합니다.

### 4.3 Tabs
- 역할: `role="tablist"`, 각 탭은 `role="tab"`, 선택 탭 `aria-selected=true`
- 키보드: 좌우 화살표/홈/엔드 이동, 탭패널 `role="tabpanel"`
- 좁은 화면에서는 탭 자체를 축소하지 않고 tablist 내부만 가로 스크롤합니다.

### 4.4 Badge
- 용도: 상태/분류 표시, 배경 대비 충분히

### 4.5 Card
- 제목은 시맨틱 헤딩(h3 등), 본문/메타 구분, 클릭 전체영역 vs 버튼 조합 규칙 정의

### 4.6 레이아웃 프리미티브(선택)
- Container, Stack(세로 간격), Cluster(수평 정렬), Grid(카드 그리드)

### 4.7 Dialog/Drawer와 Toast
- Drawer는 `role="dialog"`, `aria-modal`, Escape 닫기, 포커스 트랩, 닫힌 뒤 호출 버튼으로 포커스 복귀를 제공합니다.
- 닫기 버튼도 최소 44×44px이며 아이콘은 장식 요소로 숨기고 버튼 이름은 한국어로 제공합니다.
- 일반·성공 toast는 `role="status"`/`aria-live="polite"`, 오류 toast는 `role="alert"`/`aria-live="assertive"`를 사용합니다.
- toast는 모바일에서 좌우 16px을 확보하고 640px 이상에서 최대 폭을 제한합니다.

## 5) 패턴
- 폼 검증: blur/submit 시점, 에러 요약(필요 시), 실시간 피드백은 비침투적으로
- 빈 상태/로딩/에러: 메시지/아이콘 통일, `aria-live`로 스크린리더 알림
- 무한스크롤: 페이지마다 버튼/자동 로드 기준 일관 유지, 관찰자 여백 `rootMargin` 표준화

## 6) 접근성 체크리스트(요약)
- [x] 시맨틱 구조(h1→h2→h3), landmark(role=main/nav/contentinfo)
- [x] 포커스 순서/표시, 키보드 조작 가능
- [x] 폼 라벨/에러 연결, `aria-*` 정확성
- [x] 대비(AA 이상), 의미만 색상으로 전달하지 않기
- [x] 애니메이션은 선호도(감소) 미디어쿼리 존중
- [x] 포인터 핵심 행동 최소 44×44px
- [x] 200% 확대에서도 정보·조작 손실 없이 reflow

## 6.1 공통 구현 위치

| 계약 | 단일 구현 |
| --- | --- |
| 버튼·링크 버튼 상태/크기 | `components/ui/styles.ts`, `button.tsx`, `button-link.tsx` |
| 폼 label/helper/error | `components/ui/form-field.tsx` |
| Input/Select/TextArea 외형 | `components/ui/styles.ts`의 `FIELD_CONTROL` |
| 카드·배지·탭 | `components/ui/card.tsx`, `badge.tsx`, `tabs.tsx` |
| 모달형 메뉴 | `components/ui/drawer.tsx` |
| 알림 | `components/toast.tsx` |

## 7) 성능 가이드
- 이미지: `next/image` 사용, `sizes` 지정, LCP 이미지는 `priority`, 나머지 lazy
- 폰트: next/font로 self-host + `display: swap`(fallback metrics 자동 조정) 사용, 서브셋/가중치 최소화(예: KR 400/500/700), 전역 CSS 변수(`--font-sans`)로 Tailwind 토큰(`font-heading`, `font-body`) 매핑해 CLS 억제
- 레이아웃: 초기 뷰포트 내 요소의 레이아웃 크기를 고정(width/height or aspect-ratio)하고, 이미지 컨테이너에는 명시적 치수/비율을 제공해 레이아웃 점프 방지
- Lighthouse(모바일) 기준 Perf/A11y ≥ 0.90 유지, 예산(`lighthouse-budget.json`) 준수(폰트 리소스 상한 포함)

폰트 운영(Phase 4)
- next/font/local로 Inter Variable(woff2)을 프로젝트에 동봉하여 네트워크 의존 없이 빌드/테스트가 가능하도록 구성합니다.
- 경로: `apps/web/public/fonts/Inter-Variable.woff2`, 라이선스: `apps/web/public/fonts/OFL.txt`(SIL OFL 1.1).
- 전역 적용: `apps/web/app/fonts.ts` → CSS 변수 `--font-sans`, `app/layout.tsx`에서 `<html className={font.variable}>`.

### 7.1 폰트 도입 규칙
- 구현: `apps/web/app/fonts.ts`에서 next/font(예: `Noto_Sans_KR`)를 선언하고 `variable: '--font-sans'`로 노출 → `app/layout.tsx`의 `<html>`에 `${font.variable}` 추가
- Tailwind: `globals.css`의 `--font-heading`·`--font-body` theme variable을 `var(--font-sans)`와 시스템 폴백으로 정의해 클래스 유지보수와 전역 치환을 단순화
- 글로벌 CSS: `body { font-family: var(--font-sans), system-ui, … }`로 지정하여 초기 페인트 시 시스템 폰트 폴백이 안정적으로 적용되도록 함
- 가중치/서브셋: 화면에서 실제 사용하는 굵기만 포함(본문 400, UI 500, 헤딩 700 권장). 과도한 웨이트/서브셋 금지
- 표시 전략: `display: 'swap'` 유지(렌더 차단 최소화). next/font가 fallback metrics를 자동 보정하여 CLS < 0.1 목표 달성에 기여

### 7.2 이미지/LCP 규칙
- LCP 후보는 명시적인 `sizes`를 제공하고, 홈 히어로 등 핵심 이미지는 `priority`로 사전 로드
- 리스트/카드 썸네일은 기본 lazy(뷰포트 진입 시 로드) 유지. 스켈레톤/blur placeholder는 사용자 지각 성능이 필요한 경우에만 사용

## 8) 도입 계획
- Phase 1: 토큰/컴포넌트
- Phase 2: 디렉터리 모바일(카드/아코디언)
- Phase 3: 게시판/내비/폼
- Phase 4: 성능/접근성 마감

## 9) 테스트/검증
- Vitest 스냅샷/상호작용: 버튼/탭/폼 에러/아코디언/드로어
- Lighthouse 워크플로: `/`, `/directory`, `/board`(모바일)

## 10) 변경/버전 정책
- 본 문서는 SSOT이며 변경 시 PR로 검토: 영향 범위/스크린샷/지표 포함
- 토큰/컴포넌트 변경은 SemVer-like 라벨(major/minor/patch)로 문서에 기록

## 11) 부록
- 아이콘: 시스템 아이콘 세트(후속), 대체 텍스트/`aria-hidden` 규칙
- 모션: 감속 선호 미디어쿼리 준수, 필수 모션 외 최소화
- 사진: 실제 동문·행사 사진은 당사자 동의와 공개 범위를 확인하고, 의미 있는 사진에는 구체적인 한국어 대체 텍스트를 제공합니다.
- fallback: 사진이 없거나 공개할 수 없으면 깨진 원격 URL을 유지하지 않고 브랜드 기본 이미지 또는 이름 기반 중립 placeholder를 사용합니다. 장식 이미지는 빈 `alt`를 사용합니다.

---

## Phase 1 구현 상태
DS v1 Phase 1(토큰/프리미티브/공통 컴포넌트)은 구현 완료 상태이며, 이후 화면은 공통 primitive를 우선 사용합니다.

### 범위
- Tailwind 토큰(semantic colors/spacing/radius/shadow/container)
- 글로벌 스타일(타이포 스케일, 포커스 링)
- 공통 UI 1차: Button / Input / Select / TextArea / Badge / Card / Tabs

### 체크리스트
- [x] `globals.css`의 `@theme`에 semantic 토큰 정의(AA 대비 준수)
- [x] globals.css 타이포/포커스 링 반영
- [x] UI 7종(Button/Input/Select/TextArea/Badge/Card/Tabs) 구현 및 스냅샷
- [x] 접근성: 라벨 연결, aria-* 속성, 키보드 포커스/탭 이동 확인
- [x] `pnpm -C apps/web test && pnpm -C apps/web build` 그린
- [x] `docs/design_system.md` 토큰·컴포넌트 예시 갱신
- [x] 공통 Button/ButtonLink 크기·상태 SSOT와 44px 기준 통합
- [x] Input/Select/TextArea label/helper/error 구현 통합
- [x] Drawer·Toast 접근성 상태 표준화
- [x] axe와 CSS 소유권·중복 selector 자동 검사

### 토큰 표(요약)
- 색상
  - brand: 50~900
  - text: primary/secondary/muted/inverse
  - surface: default/raised/sunken
  - state: primary/secondary/success/info/warning/error
- 레이아웃
  - radius: sm=4, md=8, lg=12
  - shadow: xs/sm/md/lg
  - container padding: sm:px-4 md:px-6 lg:px-8

### 컴포넌트 예시

```tsx
// Button
<Button variant="primary" size="md">확인</Button>
<Button variant="secondary" size="sm">취소</Button>

// Input (a11y: 라벨/에러 연결)
<Input id="email" label="이메일" helperText="로그인에 사용" />
<Input id="nick" label="닉네임" errorText="필수 입력입니다" />

// Tabs
<Tabs
  items={[
    { id: 'a', label: '개요', content: <div>…</div> },
    { id: 'b', label: '상세', content: <div>…</div> },
  ]}
  aria-label="상세 탭"
/>
```
