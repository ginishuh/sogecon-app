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
- [ ] 시맨틱 구조(h1→h2→h3), landmark(role=main/nav/contentinfo)
- [ ] 포커스 순서/표시, 키보드 조작 가능
- [ ] 폼 라벨/에러 연결, `aria-*` 정확성
- [ ] 대비(AA 이상), 의미만 색상으로 전달하지 않기
- [ ] 애니메이션은 선호도(감소) 미디어쿼리 존중

## 7) 성능 가이드
- 이미지: `next/image` 사용, `sizes` 지정, LCP 이미지는 `priority`, 나머지 lazy
- 폰트: `font-display: swap` 또는 균형 잡힌 정책, 서브셋 고려, CLS 최소화
- Lighthouse(모바일) 기준 Perf/A11y ≥ 0.90 유지, 예산(`lighthouse-budget.json`) 준수

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

