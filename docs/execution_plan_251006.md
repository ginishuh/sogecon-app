# 실행 계획(로드맵) — 2025-10-06

본 문서는 SSOT와 현재 코드 기준으로 상태를 점검하고, M1~M4 단계 실행 계획을 정리합니다. 진행 중 변경은 이 문서를 갱신하며, 상세 하위 계획서는 `docs/m1_plan.md`, `docs/m2_plan.md`를 참조합니다.

## 현재 상태(2025-10-06)
- 백엔드(API): 레이어드 아키텍처(routers → services → repositories) 적용, 초기 모델/마이그레이션(0001) 존재, 기본 CRUD + RSVP upsert, 전역 오류 핸들러(Problem Details + code), 레이트리밋/보안 헤더.
- 프런트(Web): App Router 스캐폴드, 공용 API 클라이언트(lib/api.ts), 도메인 서비스(services/*), 목록 페이지(/posts, /events), PWA 매니페스트/서비스워커 최소본, 한국어 UI 기본.
- 품질/CI: ruff/pyright/pytest/semgrep/pip-audit/pnpm audit/gitleaks 활성, Pytest Guard 및 스모크 테스트, 훅/CI 파이프라인 동작.

## SSOT 핵심 가드(요약)
- 아키텍처: API/웹 모두 레이어 강제(라우터/컴포넌트는 서비스만 호출; ORM/fetch 직접 접근 금지).
- 오류 계약: 도메인 예외 → 전역 핸들러 → Problem Details(JSON, 안정적 code).
- 타입/품질: any/우회 주석 금지, 복잡도/파일 길이 제한, DTO는 OpenAPI로 동기화.

## 갭/보완 필요
- 인증/권한 부재(작성/관리 기능 보호 없음) → M2에서 해결.
- 이벤트 정원(capacity) 기반 대기열(waitlist) 전이 규칙 미구현 → M2에서 v2 승급 규칙.
- 상세화면/작성 폼/UI 상태 관리(캐싱/에러 토스트) 미비 → M1에서 보강.
- Web Push는 문서/스켈레톤만 존재(실구독/발송/운영 미구현) → M3.
- DTO 동기화 수동(서버 헬스 의존), 웹 타입 미연동 → M4 전에 정리.

## 실행 계획(마일스톤)

### M1: 기본 기능 완성(무인증 내부 사용 가정) — 진행/완료: docs/m1_plan.md
- Web
  - [x] 상세 화면: /posts/[id], /events/[id] + RSVP 버튼(참석/대기/취소)
  - [x] 작성 폼: 게시글/행사 생성 페이지(간단 검증), 에러 토스트 유틸(apiError→UX)
  - [x] 데이터 계층: @tanstack/react-query 도입(목록/상세 키·TTL 표준), 로딩/에러 상태 일관화
- API
  - [x] 정원 정책 v1: going 수 ≥ capacity면 자동 waitlist (기존 참석자 재요청은 유지)
  - [x] 스키마/오류 계약 보강(Problem Details code 보존)
- 테스트/타입
  - [x] 성공 경로 스모크: 목록 200, 생성 201, 상세 200, RSVP upsert 성공/갱신
  - [x] Pytest Guard/훅/CI 유지

### M2: 인증/권한 + 도메인 규칙 고도화 — 진행 중: docs/m2_plan.md, PR #3
- Auth(최소구성)
  - [x] API: 세션 쿠키 기반 로그인(/auth login/logout/me), BCrypt 해시(AdminUser)
  - [x] Web: /login, 헤더 로그인/로그아웃, 보호 라우팅(posts/new, events/new)
  - [ ] 레이트리밋 강화(로그인 시도)
- 이벤트 대기열 규칙 v2
  - [x] cancel 시 대기열→참석 자동 승급(트랜잭션; created_at 기준)
  - [ ] 회귀 테스트(취소→승급) 보강
- 테스트/보안
  - [x] 권한 테스트(401/허용), admin_login 픽스처
  - [x] bandit B101 제거(unsafe assert 미사용)
- 완료 기준: 관리자 로그인 후에만 생성 가능, 대기열 승급 동작, 20+ 테스트, CI 그린

### M3: PWA/Web Push 채널
- API: 구독 저장/삭제/테스트 발송(pywebpush+VAPID), 404/410 자동 폐기
- DB: push_subscription/notification_preference 테이블
- Web: 권한 온보딩 CTA, subscribe/unsubscribe, SW push/notificationclick
- 운영: 발송 레이트리밋, 죽은 구독 정리 배치, 관측 지표(성공률/4xx/5xx)
- 완료 기준: 개발환경 실수신 데모, 죽은 구독 정리 자동화, 25+ 테스트

### M4: 운영화/안정성
- 배포 타깃 확정(Fly/Render/EC2) + 빌드/런 파이프라인
- 구조화 로그(code·request_id), 오류 카탈로그→UX 매핑 테이블
- 성능/보안: CSP 프로덕션 강화, rate limit 정책 분리(로그인/발송), 캐시·N+1 점검, DTO 동기화 자동화

## 작업 순서(경량 PR 단위)
1) M1-1: react-query + 에러 토스트 + /events/[id]/RSVP UI
2) M1-2: /posts/[id], 생성 폼 2종, 성공 경로 테스트
3) M1-3: capacity v1 적용 + 테스트
4) M2-1: AdminUser + 로그인/쿠키 + 가드, 권한 테스트
5) M2-2: 대기열 승급 v2 + 레이스 컨디션 테스트
6) M3-1: push 구독 저장/삭제 + 클라이언트 연동
7) M3-2: 테스트 발송 + 운영 가이드/레이트리밌
8) M4-x: 배포/관측/보안 마감

## 참고/연계
- SSOT: `docs/architecture.md`, `docs/agents_base.md`
- 계획서: `docs/m1_plan.md`, `docs/m2_plan.md`
- 관련 PR: M1(#2), M2(#3)

