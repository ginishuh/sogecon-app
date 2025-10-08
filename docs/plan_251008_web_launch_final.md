# 계획서 — 2025-10-08 웹 런치 최종(한 PR 마감)

## 목적
한 번의 PR에서 공개 웹에 필요한 남은 페이지/카피/이미지, SEO/OG, 접근성/성능 보완까지 마무리한다. 계획만 담긴 PR 금지 원칙을 준수하며, 커밋은 기능 단위로 쪼개되 하나의 PR에서 순차 구현한다.

## 범위(최종)
- 소개(E) 실카피/이미지 반영: `about/greeting|org|history` (재정 공시는 선택)
- 정적 고지: `faq`, `privacy`, `terms` 페이지
- 홈 마감: 히어로/카피/배너 이미지 최종화, 디자인 토큰 보정
- 디렉터리(C): 정렬(기수순/최근수정) + 필요 시 추가 필터 1~2개
- SEO/OG: title/description 최종, 기본 OG 이미지 1개, sitemap/robots 업데이트
- 접근성/성능: landmark/aria/skip-link/포커스 이동 최종 점검, Lighthouse A11y/Perf ≥ 0.90 유지

## 산출물(DoD)
- 페이지: 위 라우트 렌더/내비 연결/반응형 OK, 더미 제거(실카피/플레이스홀더 이미지는 주석으로 표기)
- 테스트: vitest 6+ (스냅샷·SEO·접근성 속성), 기존 테스트 그린
- 빌드/라우팅: Next build OK, 정적 라우트 포함
- CI: Lighthouse Perf/A11y ≥ 0.90 통과 (PR 체크)
- 문서: `docs/worklog.md` 1줄/커밋, 최종에 `docs/dev_log_251008.md` 갱신

## 구현 체크리스트(파일 단위)
- 소개(E)
  - `apps/web/app/about/greeting/page.tsx` (실카피/이미지/alt)
  - `apps/web/app/about/org/page.tsx` (구성도/연락처 표/aria-label)
  - `apps/web/app/about/history/page.tsx` (연혁 타임라인/아카이브 이미지)
- 정적 고지
  - `apps/web/app/faq/page.tsx`
  - `apps/web/app/privacy/page.tsx`
  - `apps/web/app/terms/page.tsx`
- 홈 마감
  - `apps/web/app/page.tsx` (카피/CTA/배너 이미지)
  - `apps/web/app/globals.css` (토큰/포커스-링/스킵 링크)
- 디렉터리
  - `apps/web/app/directory/page.tsx` (정렬/필터)
  - `apps/web/services/members.ts` (정렬 파라미터 전달)
- SEO/OG
  - `apps/web/app/layout.tsx` (metadata/generateMetadata)
  - `apps/web/public/og-default.png` (기본 OG)
  - `apps/web/app/sitemap.ts` / `apps/web/app/robots.ts` 업데이트
- 테스트
  - `apps/web/__tests__/about-pages.test.tsx` (스냅샷/aria)
  - `apps/web/__tests__/home-hero.test.tsx` (히어로/CTA)
  - `apps/web/__tests__/seo-meta.test.ts` (메타/OG/sitemap/robots)

## 커밋 계획(한 PR 내 순서)
1) feat(web): 소개 실카피/이미지 반영(+스냅샷)
2) feat(web): 홈 히어로/카피/배너 최종화
3) feat(web): FAQ/Privacy/Terms 정적 페이지 추가
4) feat(web): 디렉터리 정렬/필터 확장
5) chore(web): SEO 메타/OG/sitemap/robots 최종 업데이트
6) chore(web): 접근성 보정(스킵링크/포커스/랜드마크)
7) docs(docs): worklog/dev_log 업데이트

## 검증 커맨드
- `pnpm -C apps/web test`
- `pnpm -C apps/web build`
- (CI 자동) Lighthouse Perf/A11y

## 리스크/메모
- 실카피/이미지 수급 지연 시 더미 표기 가능(주석/플래그). 교체 커밋 허용.
- OG 이미지 파일 용량 120KB 이하 권장, 1200×630 크기 권장.

