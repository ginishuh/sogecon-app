# M1 계획(데이터 계층 정리 + 기본 기능)

목표
- 프런트 데이터 계층 정리 및 기본 UX 확보: react-query 도입, 상세/생성 폼, RSVP 동작
- API 오류 계약(Problem Details + code) 정리 및 레이트리밋/보안 헤더 유지

범위(Deliverables)
- Web
  - [x] react-query 도입 및 Provider 구성
  - [x] 이벤트 목록 CSR→react-query 전환, 상세(/events/[id]) + RSVP 액션(going/waitlist/cancel)
  - [x] 게시글/행사 생성 폼(/posts/new, /events/new)
  - [x] 오류 코드→UX 매핑 유틸(apiErrorToMessage)
  - [x] 간단 토스트 컴포넌트(성공/에러 피드백)
- API
  - [x] RSVP capacity v1: going 초과 시 waitlist 강제 저장(기존 참석자 재요청은 유지)
  - [x] 전역 오류 핸들러에 code 보존(Problem Details JSON)
- 테스트/CI/훅
  - [x] 성공 경로 스모크(생성/상세/RSVP) + 에러 경로(404/409/422)
  - [x] Pytest Guard: API 변경 시 `--collect-only`≥1 보장
  - [x] gitleaks PR 스캔 토큰/권한 설정

주요 결정 및 구현 포인트
- apiFetch가 Problem Details(JSON) 파싱 시 ApiError(code/status)를 보존하여 UI 매핑이 가능하도록 함.
- RSVP capacity 계산 시 기존 참석자는 카운트에서 제외하여 재요청으로 waitlist 강등되는 문제 방지(회귀 테스트 포함).

테스트 결과
- 현재 13+ 테스트 통과(M1 완료 시점 기준), 이후 M2 도입으로 16 개로 확장됨.

연계 PR
- PR #2: feat(api,web): M1 기본기능 보강 — react-query/상세·생성 폼/RSVP capacity v1

후속(다음 단계 요약)
- M2: 세션 기반 인증/권한(관리자), RSVP v2(취소 시 대기열 승급), 보호 라우팅(Web)

