# DS v1 Phase 3 — 게시판 카드/내비/폼(초안)

## 목적
- 게시판 목록을 카드형으로 정리하고 탭/버튼 터치 타겟을 확대한다.
- 모바일 드로어 내비와 폼 키패드·오류 피드백을 개선한다.

## 작업 항목
1) /board 목록
   - 카드: 카테고리 배지/날짜/제목/요약, heading 계층
   - 탭: min-h 44–48px, 키보드 포커스 스타일
2) /board/new 폼
   - inputMode/autoComplete, 에러 문구/aria-live, 제출 버튼 상태
3) 헤더 내비
   - 드로어(포커스 트랩/aria-modal/스크롤 잠금)

## DoD
- [ ] vitest: 탭 전환/폼 제출/에러 메세지/드로어 키보드 흐름
- [ ] Lighthouse(/board): 모바일 Perf/A11y ≥ 0.90

## 브랜치/PR
- branch: `feat/ds-v1-phase3-board-nav`
- PR Title: `feat(web): DS v1 — 게시판 카드/모바일 내비/폼 UX`
- 정책: Draft → 테스트/LH 그린 후 Ready

## 리스크/메모
- 드로어 포커스 트랩 누락 주의(테스트 케이스 포함)
