# DS v1 Phase 3 — 게시판 카드/모바일 내비/폼 (Kickoff 2025-10-10)

## 목적·범위
- 게시판(/board) 목록을 모바일 친화적 카드 UI로 정돈하고, 카테고리 탭의 접근성·터치 타겟을 개선한다.
- 모바일 내비게이션 드로어를 도입(포커스 트랩, `aria-modal`, 스크롤 잠금)한다.
- 새 글 작성(/board/new) 폼의 입력 힌트(autocomplete/inputMode)와 오류 피드백(aria-live)을 보강한다.

## 산출물(코드/문서)
- UI: `PostCard` 재사용 카드 목록, 탭 min-h 44–48px, `aria-selected`/키보드 이동.
- UI: `components/ui/drawer.tsx` 접근성 드로어(ESC 닫기/Backdrop 클릭/포커스 트랩·복귀).
- Form: `/board/new` 입력 힌트/aria-live 보강.
- 테스트(초안): 탭 전환/폼 제출 흐름, 드로어 오픈/닫기 포커스 이동 스모크.
- 문서: 본 계획서 업데이트 + 워크로그/데일리 로그 기록.

## 작업 항목(세부)
1) /board 목록
   - 카드: 카테고리 배지/날짜/제목/요약(기존 마크업 정리 or PostCard 재사용)
   - 탭: min-h 44–48px, `aria-selected`, 키보드 좌우 화살표 이동, Home/End 지원
2) /board/new 폼
   - `autocomplete`/`inputMode` 지정, 제출 중 상태, 오류 `role="alert"` + `aria-live="polite"`
3) 헤더 내비(모바일)
   - 드로어 컴포넌트 추가(`components/ui/drawer.tsx`), ESC/Backdrop/포커스 트랩, body 스크롤 잠금
   - site-header 연동은 별 커밋에서 단계적으로 적용

## DoD(Ready 전)
- [ ] Lighthouse(/board): 모바일 Perf/A11y ≥ 0.90 유지
- [ ] vitest: 탭 전환/폼 오류/드로어 포커스 스모크
- [ ] ESLint/TS `strict` 통과(우회 주석 금지), 파일당 600라인 이하

## 브랜치/PR 정책
- 브랜치: `feat/ds-v1-phase3-board-nav`
- PR 제목: `feat(web): DS v1 — 게시판 카드/모바일 내비/폼 UX`
- Draft로 시작(계획서 포함). Ready 전까지 DoD 충족. Plan-only 금지(본 PR은 코드 포함).

## 리스크/완화
- 포커스 트랩 누락 → 유닛 스모크 추가, 수동 키보드 검증
- 모바일 성능 변동 → 이미지 지연로딩 유지, DOM 최소화
