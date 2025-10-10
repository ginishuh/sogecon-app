# DS v1 Phase 4 — 성능/접근성 마감 (Kickoff 2025-10-10)

## 목적
- 이미지/폰트/레이아웃 조정으로 모바일 성능 지표를 마감하고, 접근성 규칙을 점검한다.

## 작업 항목(초기)
1) Lighthouse 워크플로/예산
   - 워크플로 URL에 `/directory` 포함(이미 `/board`는 포함됨)
   - 예산(`lighthouse-budget.json`) 점검 — 최초에는 현 상태 유지, 필요 시 follow-up
2) 이미지 최적화(최소)
   - LCP 후보(next/image)에 `sizes` 지정, 홈 히어로 priority 확인
   - 상세 페이지 커버 이미지 `sizes` 지정
3) 폰트 로딩(후속)
   - next/font 도입(서브셋/가변/표시 전략)으로 CLS 방지 — 이 항목은 별 커밋로 진행

## DoD (완료)
- [x] 홈/디렉터리/게시판 Perf/A11y ≥ 0.90 (모바일 기준)
- [x] CLS < 0.1, 보고서 리그레션 없음
- [x] 문서: `docs/design_system.md` 성능 지침 반영

## 브랜치/PR
- branch: `feat/ds-v1-phase4-perf-a11y`
- PR Title: `perf(web): DS v1 — 모바일 성능/접근성 마감`
- 정책: Draft → LH 그린 후 Ready

## 리스크/메모
- 이미지 원본/remotePatterns에 따라 Lighthouse 변동성 존재 → runs:3 유지
