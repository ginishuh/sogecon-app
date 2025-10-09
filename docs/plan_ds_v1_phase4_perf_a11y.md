# DS v1 Phase 4 — 성능/접근성 마감(초안)

## 목적
- 이미지/폰트/레이아웃 조정으로 모바일 성능 지표를 마감하고, 접근성 규칙을 점검한다.

## 작업 항목
1) 이미지 최적화
   - next/image `sizes` 지정, LCP 후보 priority, 나머지 lazy 확인
2) 폰트 로딩
   - font-display 설정, 서브셋/사이즈 점검, CLS 방지
3) Lighthouse 워크플로
   - `.github/workflows/lighthouse.yml` URL에 `/directory`, `/board` 추가(모바일 대상)
   - 예산 파일(`lighthouse-budget.json`) 유지/보정

## DoD
- [ ] 홈/디렉터리/게시판 Perf/A11y ≥ 0.90
- [ ] CLS < 0.1, 보고서 리그레션 없음
- [ ] 문서: `docs/design_system.md` 성능 지침 반영

## 브랜치/PR
- branch: `feat/ds-v1-phase4-perf-a11y`
- PR Title: `perf(web): DS v1 — 모바일 성능/접근성 마감`
- 정책: Draft → LH 그린 후 Ready

## 리스크/메모
- 이미지 원본/remotePatterns에 따라 Lighthouse 변동성 존재 → runs:3 유지
