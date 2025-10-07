## 2025-10-06


- 문서: M1 계획서 추가(docs/m1_plan.md) — 범위/체크리스트/테스트/의사결정 요약
 - 문서: 실행 계획(로드맵) 추가(docs/execution_plan_251006.md) — 현재 상태/가드/갭/마일스톤/작업 순서 정리
- M2 착수: 세션 인증/권한 + RSVP v2
  - API: SessionMiddleware 추가, `/auth`(login/logout/me) 라우터, `admin_users` 마이그레이션, `RSVP.created_at` 추가
  - 권한: `require_admin` 의존성으로 posts/events/members 생성 라우트 보호
  - RSVP v2: `cancel` 시 대기열 최상위 1인 자동 승급(트랜잭션)
  - 테스트: 로그인 성공/실패, 보호 라우트 401/201 스모크 추가
  - 타입/훅 대응: bcrypt는 라우트 내부 임포트로 전환, `require_admin` 반환 타입을 의존성 시그니처에 명시
  - 세션 타입 안전화: 세션 dict를 런타임 검사·cast하여 pyright 경고 제거
  - 테스트 보강: admin_login 픽스처로 보호 라우트 생성 흐름 업데이트
  - 기존 테스트 정렬: 성공/에러 케이스에서 보호 라우트 호출 전에 admin_login 적용
  - Web: /login 페이지 추가, useAuth 훅/헤더 로그인·로그아웃 UI, 보호 라우트 가드(posts/new, events/new)
  - Web: 세션 쿠키 사용을 위해 apiFetch에 credentials: 'include' 적용
  - Web: /login에서 useSearchParams를 Suspense로 감싸 Next 빌드 에러 해결
  - API: /auth 로그인 시도 레이트리밋(5/min/IP) 적용(함수 내부 체크, Request 인자 수용); 테스트클라이언트는 면제 처리
  - 테스트: RSVP v2 승급(취소→대기열 최상위 going) 회귀 테스트 추가
  - 문서: architecture.md에 인증/권한/RSVP v2 정책 반영
  - 훅 보강: pre-push가 requirements 변경 시 pip install을 수행해 의존성 누락으로 인한 실패 방지
- M2 브랜치/PR 초안: 세션 인증/권한 + RSVP v2 계획 문서 추가(docs/m2_plan.md)

## 2025-10-07

- M3-4: prune-logs/guard 추가, 암호화·통계 완료. 마이그레이션 린트 수정, 스키마 재생성(encryption_enabled), repo guards에 packages/schemas 제외.

## 2025-10-06



- 테스트 픽스처(conftest): `# noqa: E402` 우회 주석 제거 및 `sys.path` 조작 삭제. import 순서 정리로 Ruff 규칙 위반 해소(레포 가이드 준수).
 - conftest: CI 환경 호환을 위해 함수 내부에서 `apps.*` 지연 import 및 `sys.path` 보정으로 동작 유지(우회 주석 없이 해결).
 - 테스트 루트 `tests/conftest.py`에서 `sys.path` 보정 추가(패키지 import 안정화).
 - CI: Pytest Guard(`ops/ci/pytest_guard.py`) 추가 — API 관련 변경 시 `pytest --collect-only`로 수집 ≥1 보장.
 - CI: gitleaks 액션에 `GITHUB_TOKEN` 주입 및 `permissions: pull-requests: read` 설정(PR 스캔 실패 수정).
 - 테스트 확장: 404(post/event/rsvp), 409(rsvp_exists), 이벤트 RSVP upsert(생성/업데이트), 잘못된 enum→422 케이스 추가.
 - CI 파이프라인: Python 잡에 Pytest Guard + pytest 실행 단계 추가.
 - Web(M1-1 시작): react-query 도입(QueryClientProvider), 이벤트 목록 CSR→react-query 전환, 이벤트 상세 페이지(/events/[id]) + RSVP 액션(going/waitlist/cancel), API 오류 코드→UX 매핑 유틸 추가.
 - API: RSVP capacity v1 적용(going 요청 시 정원 초과면 waitlist로 저장).
   - pyright 타입 오류 추가 수정: SQLAlchemy 인스턴스 속성 안전 추출로 경고 제거.
 - Web: 간단 토스트(ToastProvider) 추가, 게시글/행사 생성 및 RSVP 액션 성공/에러 피드백 연결.
 - 테스트 확장(성공 경로): 목록 200 검증, /rsvps 생성 201 스모크.
 - Dev: VS Code 디버그 설정 추가(`.vscode/launch.json`) — API(SQLite/Postgres), Web 단일/복합 실행 지원.
 - Repo: .gitignore 정리 — `.env`/`.env.*` 무시, 단 `.env.example`은 명시적으로 추적.
 - 환경 예시(.env.example) 정리 — SQLite 기본값, Postgres 옵션 주석, NEXT_PUBLIC_WEB_API_BASE로 웹 변수 통일, 한국어 주석 보강.
 - Dev DB 포트: Docker Postgres 개발 기본 포트를 5433으로 전환(ports: "5433:5432"), .env.example/launch.json 동기화.
 - Pytest DB 스위치: 기본 SQLite, `TEST_DB=pg` 설정 시 `TEST_DB_URL`(또는 `DATABASE_URL`)로 Postgres 테스트 지원(안전가드 포함).
 - 테스트 전용 DB: docker-compose에 `postgres_test`(5434) 추가, Make 타깃(`db-test-up`), VS Code 런치(Pytest PG) 동기화.
- 리뷰 반영(P1):
  - API: RSVP capacity 계산 시 기존 참석자 제외(재요청으로 인한 부당 강등 방지).
    - pyright 호환 보완: 기존 상태 비교 시 enum 캐스팅으로 타입 안정화.
  - Web: apiFetch에서 Problem Details code를 보존(에러 코드→UX 매핑 동작 보장).
  - 보안: bandit(B101) 지적된 assert 제거 — 이벤트 용량 검사는 사전 조회한 capacity로 처리.
    - 타입: capacity는 `cast(int, event.capacity)`로 지정하여 pyright 오류 해소.

- M3 착수: 브랜치 `feat/m3-webpush` 생성, `docs/m3_plan.md` 추가, 실행 계획 문서에 진행상태 반영.
  - API 스캐폴드: `apps/api/models.py`에 push_subscriptions/notification_preferences 모델 추가, 알렘빅 마이그레이션(0004, 0005) 초안 추가.
  - 라우터 스캐폴드: `apps/api/routers/notifications.py` 추가(구독 저장/삭제, 어드민 테스트 발송; 초기 204/202 스텁), `apps/api/main.py`에 include.
  - 정적타입 보완: 클래식 매핑 모델 속성 갱신을 `setattr`로 처리하여 pyright 경고 제거.
  - 본구현(표준 Web Push): `services/notifications_service.py`(VAPID/pywebpush Provider, 404/410 자동 폐기), `repositories/notifications.py` 추가, 라우터를 서비스/리포지토리 경유로 리팩터링. 우회 주석 제거.
  - 타입: `SubscriptionData` TypedDict 도입, pyright 적합성(cast/주석) 정리, 관리자 발송 레이트리밋 타입 보완.
  - TypedDict 안전 접근으로 `member_id` 처리 로직 경고 제거.
  - Web: Service Worker에 push/notificationclick 핸들러 추가, 구독 유틸(lib/push.ts) 및 서비스 호출(services/notifications.ts) 구현, CTA 컴포넌트(components/notify-cta.tsx) 추가 및 레이아웃에 연결. 204 응답 처리 위해 apiFetch 204 대응.
  - Web(Admin): `/admin/notifications` 페이지에서 테스트 발송(제목/본문/URL) UI 추가.
  - API: 테스트 발송 payload에 `url` 필드 추가, SW 클릭 시 해당 URL 포커스/열림.
  - API(Admin): 발송 로그/통계 엔드포인트 추가(`/admin/notifications/logs`, `/admin/notifications/stats`). 로그는 endpoint 해시/테일만 저장(민감정보 마스킹).
  - 타입 보완: 로그 DTO 변환 시 pyright 캐스팅으로 Column 타입 경고 제거.
  - pyright: Column truthiness 경고 회피를 위해 isinstance 기반 변환 적용.
  - Web(Admin): /admin/notifications에 요약(활성 구독/성공/실패)과 최근 발송 로그 테이블 추가, 새로고침 버튼.
  - Web: `lib/api.ts`의 `apiFetch`를 헬퍼 분리로 복잡도 10 이하 리팩터링(ESLint complexity 통과).
  - 문서(SSOT/에이전트 베이스): 로컬 DB 도커화/포트 변수(`DB_DEV_PORT`,`DB_TEST_PORT`)·CORS JSON 규칙·Web Push 운영 가드·Admin 경로를 agents_base(en/kr)/architecture에 반영.
  - Web: 개발환경에서 서비스워커 등록을 기본 비활성화(NEXT_PUBLIC_ENABLE_SW=1로 강제). Next.js App Router RSC 스트리밍 중 "Connection closed" 오류 완화.
  - API: 구독 저장/삭제는 인증 필요로 변경(임시로 admin 세션 사용). 레이트리밋 데코레이터의 타입 부족은 1줄 억제 주석과 제거 계획/일자(TODO 2025-11-15)로 문서화.
  - API: FastAPI 의존성 타입 시그니처 보완 및 레이트리밋 래퍼를 Protocol로 엄격화(pyright 경고 제거).
  - API: Protocol 반환 타입을 직접 Callable로 명시하여 pyright "unknown"/"invalid type form" 오류 제거.
  - Git hygiene: `.api-dev.pid`, `.web-dev.pid`, `logs/`를 `.gitignore`에 추가하고 추적 해제(동기화 잡음 제거).
  - API: 구독 저장 로직에서 클라이언트 member_id 입력 참조 제거(pyright 오류 수정, 서버 신뢰 경로만 사용).
# Worklog

## 2025-10-05
- 타입 명세 강화: 서비스/리포지토리 payload에 Pydantic 스키마 타입 적용(pyright strict 통과), SQLAlchemy Enum 속성은 `setattr`로 할당
- `events_service.upsert_rsvp_status`에서 `RSVPCreate` 인스턴스 생성해 레포 호출(딕셔너리 전달 제거)
- RSVP 상태 타입을 `schemas.RSVPLiteral`로 명시(events_service)해 pyright 엄격 모드 오류 제거
- 전역 예외 핸들러 추가: 도메인 예외(NotFound/AlreadyExists/Conflict) → HTTP 상태(404/409)로 매핑, 라우터의 try/except 제거
- 정적 분석 정리: 전역 예외 핸들러 참조를 유지해 pyright의 unused 경고 해소
- 테스트 스캐폴드 추가: FastAPI TestClient + SQLite 임시 DB로 404(`member_not_found`)·409(`member_exists`) Problem Details 검증
- API 계층화 적용: Routers → Services → Repositories 구조 스캐폴드(`apps/api/services/*`, `apps/api/repositories/*`, `apps/api/errors.py`) 추가 및 기존 라우터 전면 위임으로 리팩터링
- Web 데이터 계층 도입: 공용 API 클라이언트(`apps/web/lib/api.ts`)와 도메인 서비스(`apps/web/services/posts.ts`, `apps/web/services/events.ts`) 추가, 페이지에서 직접 fetch 제거
- `docs/architecture.md`를 SSOT 규칙에 맞춰 레이어드 아키텍처 강제 문구로 갱신
- 모바일 웹 우선 원칙과 PWA/Web Push 지원을 아키텍처에 반영, SMS 채널 보류 명시 및 세부 가이드(`docs/pwa_push.md`) 추가
- 에이전트 베이스 문서 추가(`docs/agents_base.md`, `docs/agents_base_kr.md`) 및 AGENTS/CLAUDE/Copilot 문서 동기화
- 품질 가드 도입: 우회 주석 금지/파일 600줄 제한/복잡도 가드 스크립트(`ops/ci/guards.py`), Ruff/Pyright/ESLint 설정 강화
- CI에 레포 가드 잡 추가, 프리커밋 훅에 레포 가드 실행 포함
- API 레이트리밋 도입(`slowapi==0.1.9`), 기본 per-IP 120/minute. FastAPI 미들웨어와 예외 핸들러 연결
- pre-push 훅이 활성 venv 우선으로 `pyright` 실행 후, 테스트 존재 시 `pytest -q`까지 수행하도록 강화
- commit-msg 훅 실행 권한 추가 및 Conventional Commits 규칙 적용 확인
- pyright 오류 수정: SecurityHeadersMiddleware.dispatch 타입 보강 및 레이트리밋 예외 핸들러 래퍼; 마이그레이션 폴더는 pyright 제외
- pre-push 훅: 테스트 파일 탐색 로직 수정(매치 없을 때 pytest 미실행)
- repo-guards: 빌드 산출물 `.next` 디렉터리 제외(@ts-ignore false positive 방지)
- pre-push 훅에서 웹 빌드 제거(CI에서만 실행). 과도기 플래그는 폐기
- 웹: Tailwind v3.4.13로 다운그레이드(안정화), PostCSS 설정 복원(tailwindcss 플러그인)
- CI: gitleaks 액션 입력 경고 제거(args 제거) 및 shallow fetch 문제 해결(fetch-depth: 0)
- CI: Corepack으로 pnpm 버전 고정(10.17.1) — repo-guards/web 잡 모두 적용
- CI 트리거를 PR 전용으로 전환(push:main 제거), concurrency로 중복 실행 방지
- 루트 package.json은 제거(불필요). pnpm pin은 apps/web/package.json + CI Corepack으로 유지
- API: ruff 오류 정리(E501/I001/UP*), FastAPI 관례(B008)는 ruff 설정에서 예외 처리
- SQLAlchemy: 타입체커 호환을 위해 setattr 패턴 유지, ruff에서 B010 예외 처리
- 에이전트 베이스: 언어/커뮤니케이션 규칙을 영문/국문 베이스 문서에 명시(코드 주석/문서/커밋/PR은 한국어 기본)
- 에이전트 가이드 정리: 베이스(`docs/agents_base*.md`)의 SSOT 섹션 제거, `AGENTS.md`/`CLAUDE.md`/`copilot-instructions.md`에 비‑SSOT 배너만 유지
- 에이전트 문서 동기화: `AGENTS.md`/`CLAUDE.md`/`copilot-instructions.md`에 Agents Base(영문) 전체 본문을 'verbatim copy'로 포함하여 각 문서 단독으로 완결성 확보
 - 한글 베이스 동기화: `docs/agents_base_kr.md`에 동일 SSOT 섹션을 추가(영문 베이스와 의미 동등)

## 2025-10-06(추가)
- Web(dev) CSP 완화: HMR/RSC/인라인 부트스트랩 허용(`unsafe-inline`, `unsafe-eval`, `blob:`) — 프로덕션은 그대로 엄격.
- Web: RSC ‘flight’ 요청 로깅용 dev 미들웨어 추가(`apps/web/middleware.ts`).
- Web: favicon 404 노이즈 제거(임시 204 라우트 추가).
- Makefile: `api-*/web-*` 백그라운드 태스크와 `dev-up|down|status` 추가, 로그/ PID 분리.
- Hooks: pre-push에서 `logs/*`, `*.log`, `*.pid`, `.next/`, `node_modules/` 등 히스토리 상의 잡파일 무시하도록 필터링 추가.
- API: WebPush provider 예외 범위 축소 — `except Exception` 제거, `ValueError|TypeError|RuntimeError|RequestException`만 처리(가드 준수).
- API: RSVP 취소 시 승급 로직 트랜잭션 강화 — SAVEPOINT(begin_nested)로 후보 조회+승급을 한 단위로 처리하고, Postgres에서는 `SELECT … FOR UPDATE SKIP LOCKED` 적용(경합 완화). 복잡도 초과 방지를 위해 헬퍼로 분리.
- 리뷰 대응 추가: 테스트 더미 공급자 타입 시그니처 보강(# type: ignore 제거), Next.js 미들웨어에서 불변 헤더 직접 수정 문제 수정(Headers 복제 후 전달), 0001 마이그레이션을 SQLite 호환으로 조정(dialect 분기).

## 2025-09-28
- .gitignore에 mypy/ruff 캐시 폴더를 추가해 불필요한 상태 변화를 제거
- AGENTS.md 본문을 영어로 통일하면서 한국어 우선 커뮤니케이션 규칙을 유지
- 프로젝트 스캐폴드 구성 완료 (API, Web, Schemas, Infra, Ops)
- 프리커밋/프리푸시 훅 및 CI 구성 초안 마련
- pyright 타입 검사를 .venv 기반 dev requirements에 통합하고 프리커밋/CI와 연동
- 훅 중복 검사를 줄이기 위해 pre-commit/CI 책임을 분리하고 pre-push에서 pyright만 실행하도록 조정
- AGENTS.md를 최신 가이드(훅 역할 분리, Draft PR 정책 등)로 갱신
- pytest를 dev requirements에 추가하고 문서/가이드에 테스트 실행 방법을 반영
- FastAPI 라우터 반환 값을 Pydantic으로 검증해 pyright 오류를 제거하고 enum 캐스팅을 보완
- pyright 경고를 해소하기 위해 RSVP 상태 설정 방식을 조정하고 config에 루트 경로를 추가
- 프리푸시 훅이 API 건강 체크 후 스키마 생성을 수행하도록 개선
- Next.js 빌드가 권장하는 tsconfig/next-env 업데이트를 반영해 반복 diff를 방지
- 홈 화면에서 실시간 fetch 대신 안내 문구로 헬스 체크 정보를 전달하도록 단순화
- README 상단에 영어 요약 및 quickstart를 병기해 국제 협업 대비
- `.github/copilot-instructions.md`를 추가하여 AI 코딩 에이전트용 가이드를 정리
- `docs/architecture.md`를 신설하고 에이전트 지침 문서에 교차 링크를 추가


## 2025-10-07
- M3 phase-2 착수: 구독 엔드포인트를 멤버 세션 가드로 전환(임시로 admin 세션을 멤버로 간주), 401/422 테스트 추가, CTA UX 개선.

- 429 테스트 추가(관리 발송 레이트리밋) — httpx.AsyncClient+ASGITransport로 client IP 설정, slowapi 파라미터명 수정(request).
- 테스트 정리 강화: 429 테스트에서 provider override를 try/finally로 복구. Web CTA는 ApiError.status로 401 판별.
- 멤버 인증 추가: MemberAuth 모델/마이그레이션, /auth/member(login/logout/me), require_member 실제 세션 사용. 테스트는 member 세션으로 구독 경로 검증.
- Web: 로그인 페이지에 멤버/관리자 토글 추가, 세션 훅이 멤버/관리자 자동 판별, 헤더 로그아웃 통합.
- Web: 헤더에 역할 배지(멤버/관리자) 추가, 로그인 페이지 안내 문구 추가.
- Web: RequireMember 가드 추가 및 로그인 모드(localStorage) 기억.
- Web: RequireAdmin/RequireMember 가드 도입, 관리자 UI 링크와 페이지 보호. 로그인 모드 저장.
- Web: admin notifications 페이지를 RequireAdmin으로 보호.
- Web Push: 구독 at-rest 암호화(옵션, AES-GCM) 추가. endpoint_hash로 결정적 조회. 통계에 encryption 플래그 포함.
- Web Push: 관리자 prune-logs 엔드포인트 추가 및 테스트.
 - 테스트/유틸: 설정 캐시 재적용 유틸(`reset_settings_cache`) 추가 및 암호화 스모크 테스트 도입.
- 문서/환경: `.env.example`에 `PUSH_ENCRYPT_AT_REST`, `PUSH_KEK` 예시 추가. Admin Notifications에 암호화 ON/OFF 표시.
- 마이그레이션: 0008 endpoint_hash backfill의 MetaData.bind 사용 제거(pyright 경고 해소).
- 마이그레이션: 0009 endpoint_hash NOT NULL 전환(누락분 백필 후 제약 강화).
- 보안/안정성: crypto_utils.decrypt_str가 키 불일치/손상 시 예외 대신 원문 반환으로 안전 실패(크래시 방지). 테스트 추가.
- 의존성: pip-audit 경고 해소 위해 cryptography 44.0.1로 상향(43.0.1 → 44.0.1).
- ABC Phase 1: 활성화/비번변경/문의 기본 라우트 추가 및 테스트. 문의는 파일 로그로 수집(레이트리밋 1/min/IP). 총 28 테스트 통과.
- ABC Phase 1: 타입/린트 보완(pyright OK), itsdangerous 토큰 기반 활성화 경로 안정화.
- Web: /activate, /settings/password, /support/contact, /me, /directory 스케폴드 및 폼/토스트 연결. next build OK.
- B v1: /me GET/PUT(이름/전공/공개범위) API 추가, Web 편집 폼 연동.
- 테스트: /me GET/PUT 프로필 업데이트 케이스 추가.
- 보정: profile 라우터 임포트 정렬(ruff) 및 pyright 캐스팅 보완.
- C v0: /members 필터(q/cohort/major) 추가(기본 private 제외). Web /directory 목록 연동(react-query).
- A-4: /support/contact 입력 검증(min/max), honeypot, 1MiB 로그 로테이션. 429/422 테스트 추가. 전체 31 테스트 통과.
- 마무리: 디렉터리/문의 경로 린트·타입 보완 및 문서 갱신.
- 디렉터리: useInfiniteQuery 기반 무한스크롤(더 불러오기) 추가.
- 문의: 키워드 스팸 드롭 및 60초 중복 쿨다운.
 - B v1 확장: members에 birth_date/birth_lunar/phone 컬럼 추가(0010), /me 폼 입력 연동.

- Web: favicon 제공(app/icon.svg)으로 /favicon.ico 404 제거.
- Web: /directory 검색·필터 디바운스(400ms) + URL 자동 동기화 적용.
- Docs: 에이전트 베이스 PR 템플릿 사용 규칙 확인(영/국문 베이스와 AGENTS.md 정합성 점검).
- API: support 티켓 저장용 TypedDict 필수/선택 키 명시(NotRequired)로 pyright 오류 해소.
 - Web: Next typedRoutes와 호환되도록 router.replace에 안전한 `Route` 캐스팅 적용.
 - Web: /directory 페이지에 Suspense 래퍼 추가(useSearchParams 규칙 준수). 프로덕션 빌드 오류 해결.
- API: bandit(B110) 대응 — support 로그 로테이션에서 광범위 예외 대신 (OSError, PermissionError)만 포착하고 경고 로그 남김.
- Docs: M3 Push Polish 세부 계획 추가(`docs/m3_push_polish_plan_251007.md`), `docs/plan_251007.md` 다음 단계 섹션 갱신.
- Web: admin notifications에 prune-logs UI 및 암호화 상태 배지 추가, 로그 표시 개수 선택 지원.
 - API: notifications 통계(range=24h/7d/30d) 및 실패 분포(404/410/기타) 추가.
 - Web: admin notifications 요약에 기간 필터/실패 분포 표시, prune 응답의 기준시각(before) 토스트 출력.
 - Fix: pyright 호환(UTC alias→timezone.utc, ok 필드 캐스팅) 적용.
