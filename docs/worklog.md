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
