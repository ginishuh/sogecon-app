## 2025-10-25 (모바일 홈 SSOT 정렬)

- 목표: `docs/Project_overview.md`의 홈 화면 SSOT에 맞춰 모바일 구성을 정렬하고, 브랜드 가이드 반영 상태를 마무리

- 주요 변경
  - 홈 퀵 액션(2×2) 섹션 추가: `/directory`, `/events`, `/posts`, `/board` 빠른 진입(접근성 라벨 포함)
  - 히어로 일러스트 모바일에서도 노출(패딩 축소, `sizes="100vw"` 유지)
  - 섹션 순서 재정렬: 히어로 → 퀵 액션 → 공지/행사 카드 → 회장 인사말 카드(프리뷰) → 스냅숏
  - 헤더 한 줄 유지: 로고 폭/간격 축소(`w-[96px]`), 타이틀 `whitespace-nowrap` 유지

- 테스트
  - `home-quick-actions.test.tsx` 신설: 라우트/라벨 검증, 인사말/스냅숏 존재 확인
  - `home-hero.test.tsx` 스냅샷 갱신
  - `about-pages.test.tsx`, `site-header-drawer.test.tsx`는 `QueryClientProvider`/토스트 의존성 반영 및 단순 목으로 안정화

- 기타
  - `NavDropdown`에 `import React` 추가(테스트 빌드 JSX 변환 호환)
  - `docs/worklog.md` 업데이트

- 관련 이슈: #28

