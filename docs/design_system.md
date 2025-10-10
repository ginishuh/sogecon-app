# 디자인 시스템 v1 (초안)

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
Tailwind 설정(`apps/web/tailwind.config.ts`)에서 semantic 레이어로 정의합니다.

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

### 3.4 브레이크포인트
- 기본 Tailwind(`sm/md/lg/xl/2xl`) 사용
- md 미만: 카드 뷰/아코디언 등 모바일 패턴 우선

## 4) 컴포넌트 가이드
각 컴포넌트는 a11y 속성, 상태(기본/hover/active/disabled/error), 크기(sm/md/lg)를 제공합니다.

### 4.1 Button
- 변형: primary/secondary/ghost/danger
- 상태: loading/disabled
- a11y: aria-busy, 명확한 라벨, 키보드 포커스 링

### 4.2 Input/Select/TextArea
- 라벨/헬프/에러 텍스트 연결: `id`/`htmlFor`, `aria-describedby`
- 모바일 키패드: `inputMode`/`autoComplete`
- 에러: 색상+아이콘(선택), `aria-invalid=true`

### 4.3 Tabs
- 역할: `role="tablist"`, 각 탭은 `role="tab"`, 선택 탭 `aria-selected=true`
- 키보드: 좌우 화살표/홈/엔드 이동, 탭패널 `role="tabpanel"`

### 4.4 Badge
- 용도: 상태/분류 표시, 배경 대비 충분히

### 4.5 Card
- 제목은 시맨틱 헤딩(h3 등), 본문/메타 구분, 클릭 전체영역 vs 버튼 조합 규칙 정의

### 4.6 레이아웃 프리미티브(선택)
- Container, Stack(세로 간격), Cluster(수평 정렬), Grid(카드 그리드)

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
- Tailwind: `tailwind.config.ts`의 `fontFamily.heading/body`를 `['var(--font-sans)', 'system-ui', …]`로 정의해 클래스 유지보수와 전역 치환을 단순화
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

---

## Phase 1 작업 범위(초안)
본 섹션은 DS v1 Phase 1(토큰/프리미티브/공통 컴포넌트) 구현 체크리스트입니다. 구현 완료 시 본 섹션은 요약으로 축약하거나 제거합니다.

### 범위
- Tailwind 토큰(semantic colors/spacing/radius/shadow/container)
- 글로벌 스타일(타이포 스케일, 포커스 링)
- 공통 UI 1차: Button / Input / Select / TextArea / Badge / Card / Tabs

### 체크리스트
- [x] tailwind.config.ts에 semantic 토큰 정의(AA 대비 준수)
- [x] globals.css 타이포/포커스 링 반영
- [x] UI 7종(Button/Input/Select/TextArea/Badge/Card/Tabs) 구현 및 스냅샷
- [x] 접근성: 라벨 연결, aria-* 속성, 키보드 포커스/탭 이동 확인
- [x] `pnpm -C apps/web test && pnpm -C apps/web build` 그린
- [x] `docs/design_system.md` 토큰·컴포넌트 예시 갱신

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
