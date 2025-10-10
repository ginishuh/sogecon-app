# DS v1 Phase 2 — 디렉터리 모바일 카드 뷰/필터 (Kickoff 2025-10-10)

## 목적
- 모바일에서 가독성과 상호작용성을 높이기 위해 카드 뷰를 도입하고, 필터 UI를 아코디언/풀폭으로 개선한다.

## 작업 항목
1) 카드 뷰 (md 미만)
   - 리스트 아이템: 이름/이메일/기수/회사 요약 + 펼치기 상세(전공/업종/공개범위)
   - 접근성: heading 계층, aria-expanded, 키보드 토글
2) 필터/정렬
   - 아코디언 감싸기, inputMode/autoComplete 지정, 공유 링크 토글 버튼화
3) 레이아웃/성능
   - 카드 내부 이미지/아이콘 없으면 텍스트만, 무한스크롤 버튼 영역 재배치

## DoD
- [ ] 반응형: md 미만 카드 뷰, md 이상 테이블 유지(접근성 보존)
- [ ] 상호작용: 카드 펼치기(aria-expanded/키보드 토글), 아코디언 필터, 공유 링크 토글 버튼화
- [ ] 테스트(vitest): 카드 렌더/펼치기/아코디언/공유 링크 토글
- [ ] E2E(CDP): URL 동기화·카드 펼치기 스모크 추가(`/directory`)
- [ ] 성능/접근성: Lighthouse(모바일) Perf/A11y ≥ 0.90 유지, 예산 준수(lighthouse-budget.json)

## 브랜치/PR
- branch: `feat/ds-v1-phase2-directory-mobile`
- PR Title: `feat(web): DS v1 — 디렉터리 모바일 카드 뷰/필터`
- 정책: Draft 시작 → 카드/테스트/LH 그린 후 Ready
- 체크리스트(머지 전):
  - [ ] vitest 그린, `pnpm -C apps/web build` 그린
  - [ ] E2E(CDP) `/directory` 스모크 통과
  - [ ] Lighthouse 리포트 링크 PR 코멘트 확인(Perf/A11y ≥ 0.90)

## 리스크/메모
- 데이터 행 수↑에서 스크롤 성능 주의(가상화는 후속 검토)
- 아코디언/카드 토글 상태가 URL과 엮이지 않도록(뒤로가기 UX 저하 방지)
