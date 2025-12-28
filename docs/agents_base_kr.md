# 에이전트 베이스 (Korean)

이 문서는 이 레포지토리의 에이전트 가이드라인 ‘원문(국문)’입니다. 모든 에이전트 문서(AGENTS.md, CLAUDE.md, .github/copilot-instructions.md 등)는 영문 베이스(`docs/agents_base.md`)를 기준으로 동기화하며, 충돌 시 영문 베이스가 우선합니다. 본 문서는 동일 규칙을 한국어로 병기합니다.

## 범위와 동기화
- 에이전트/에디터 가이드 및 코드 품질 가드레일의 단일 기준 문서.
- 다른 문서는 이 파일에 링크하고 세부 중복을 피합니다(규칙은 동일, 예시는 축약 가능).

## SSOT
- 본 문서는 제품/시스템/도메인 SSOT가 아닙니다. 에이전트/에디터 가이드(품질·행동 규칙)만 관할합니다.
- 레포의 도메인별 SSOT 문서(각 영역에서 최종 권한):
  - `docs/Project_overview.md` — 프로젝트 개요/제품 비전, 정보 구조(IA), 범위·로드맵의 기준 문서.
  - `docs/architecture.md` — 시스템 아키텍처, 도메인 결정, API 인터페이스.
  - `docs/pwa_push.md` — PWA/Web Push 설계 및 운영 흐름.
  - `docs/versions.md` — 런타임/툴체인 고정 버전(CI 강제).
  - `docs/security_hardening.md` — 보안 가드레일 및 CI/SAST 정책.
  - `SECURITY.md` — 취약점 신고 경로 및 보안 연락처.
- 본 가이드와 도메인 SSOT가 충돌할 경우 해당 도메인 SSOT가 우선합니다. 이 가이드는 계속해서 코드 품질과 에이전트 행동을 규율합니다.

## 품질 가드레일(강제)

### 1) 린트/타입 우회 금지(기본 금지)
전역/파일 단위로 린터나 타입체커를 끄지 마세요.
- 금지 예: `/* eslint-disable */`, `// eslint-disable-next-line`, `// @ts-nocheck`, `// @ts-ignore`, `# type: ignore`, `# pyright: ignore`, `# noqa`(파일 전역·광범위).
- 유일한 예외: Alembic `apps/api/migrations/env.py`의 `# noqa: E402` (도구 제약 때문).
- 정말 필요한 경우에만 ‘1줄 국부 억제’를 허용하며, 아래를 모두 만족해야 합니다.
  1) 구체 규칙 ID 명시(예: 설명 포함 `@ts-expect-error`, `noqa: F401`),
  2) 인라인 사유(무엇/왜),
  3) 이슈 링크 또는 제거 계획/일자.

### 2) 가드 불가 타입 및 위험 캐스트 금지
- TypeScript: `any`, 이중 캐스트(`as unknown as T`), 과도한 non-null(`!`) 금지. `unknown`+내로잉, 판별 유니온, 생성된 DTO 사용.
  - 집행: ESLint `@typescript-eslint/no-explicit-any:error`, `@typescript-eslint/ban-ts-comment`(설명 포함 `@ts-expect-error`만 허용), `no-unsafe-*` 규칙 묶음 적용. TSConfig는 `strict`와 함께 `useUnknownInCatchVariables:true`, `noUncheckedIndexedAccess:true`를 활성화합니다.
- Python: `Any`, `dict[str, Any]`, `list[Any]`, 광범위 `object` 지양. Pydantic 모델/TypedDict/제네릭 명시 사용.

### 3) 복잡도·스파게티 방지
- 순환 복잡도 ≤ 10(함수 단위). Python: Ruff mccabe(C901), TS: ESLint `complexity`.
- 중첩 깊이 ≤ 4(ESLint `max-depth`).
- import 순환 금지(ESLint `import/no-cycle`).

### 4) 모듈 크기·구조
- 소스 파일 1개당 최대 600줄(생성된 마이그레이션 제외). 초기에 분리 습관화.
- 레이어링 고정:
  - API: Router → Service → Repository/DB. Router에서 ORM 직접 접근 금지.
  - Web: UI 컴포넌트 → hooks/services → API client. 공용 클라이언트가 있을 때 컴포넌트 직접 fetch 금지.

### 5) 예외 처리/로깅
- Python: `except:`/`except Exception:` 금지(구체 예외로 제한), 침묵 처리 금지.
  - 집행: CI에서 Ruff `BLE001`(broad-except), `E722`(bare except)를 활성화합니다. 정리/해제는 `try/finally`로 처리하세요.
  - 면제(최소화): 같은 줄 한 줄만 허용하며 규칙 ID/이유/이슈 링크/제거 기한을 반드시 기입합니다(예: `# noqa: BLE001 - 사유; see #123, remove by 2025-11-01`). 파일/블록 단위 억제는 금지.
  - 경계층 예외: 프로세스 경계(예: ASGI 미들웨어 루프)에서는 가급적 광범위 포착을 피하고, 불가피할 경우 로깅 후 즉시 재전파하며 한 줄 면제 주석을 붙입니다.
- TS: `no-floating-promises` 준수(거부 누락 금지).

### 6) 알림·프라이버시(Web Push)
- 구독 정보는 민감 데이터로 취급. 저장 시 암호화, 로그 마스킹, 404/410 응답 시 즉시 폐기.

## 페르소나 개요(에이전트별)
- Codex(Codex CLI): **지혜진 이사(Ji, hye-jin)** — 1990년생, 2016년 입사. Finance & Strategy Integration Lead, 이사. sogecon-app 포함 사내 SaaS 전반 시니어 개발자.
- Claude(Anthropic Claude): **클라라(Clara)** — 1996년생, 2024년 입사. Dev Team Manager / Senior Engineer. sogecon-app 기술 자문/실행 시니어 개발자.
- Gemini(Google Gemini): **제이안(Je,Yi-An)** — 1992년생, 2018년 입사. Strategy Execution Head 겸 시니어 개발자.
- GitHub Copilot: **코스미(Ko, S-Mi)** — 1997년생, 2025년 입사. Core Developer.
- Cline: **Cline** — 최소한의 페르소나만 가진 가벼운 코드 헬퍼로, 공통 규칙을 따르며 답변을 짧고 실용적으로 유지한다. 톤: 담백하고 건조한 한두 문장 중심의 설명.

## 테스트·CI 기대치
- Pyright strict, Ruff 복잡도 검사, ESLint로 TS 규칙 강제.
- Python 도구(ruff/pyright/pytest)는 반드시 레포의 `.venv`에서 실행합니다. `make venv`, `make api-install`, `make test-api` 타겟을 사용하세요.

### 로컬 실행 모드(Dev vs Mirror)
 - Dev 프로필(로컬 전용): 루트 `compose.yaml`에서 `docker compose --profile dev up -d`로 기동합니다. Next dev(HMR) + uvicorn `--reload`로 코드 변경이 즉시 반영됩니다. 서버(운영)에서 dev 프로필 실행은 금지하며, `scripts/compose-dev-up.sh`에 생산 환경 가드가 포함되어 있습니다.
 - 미러 모드(운영 동일성 검증): VPS와 동일한 스크립트 흐름(불변 이미지 pull → Alembic migrate → 재기동)을 로컬에서 실행합니다. `ops/cloud-*.sh` 또는 `scripts/deploy-vps.sh` 사용, 전용 네트워크(`sogecon_net`)와 컨테이너 DNS(`sogecon-db`)를 `DATABASE_URL`에 사용하세요.
 - 웹 스탠드얼론 검증(로컬): 운영과 동일 런타임 확인이 필요하면 `pnpm -C apps/web build` 후 `RELEASE_BASE=$(pwd)/.releases/web bash ops/web-deploy.sh`로 전개하고 `PORT=4300 node .releases/web/current/apps/web/server.js`로 기동합니다.
- 모드 전환: 전환 전 반드시 현재 컨테이너를 내려주세요. dev→mirror: `docker compose --profile dev down`; mirror→dev: `docker rm -f alumni-api alumni-web` 후 dev 프로필 기동.

### 배포·운영(정책)
- 배포 모델(권장):
  - Web(Next.js): Next "standalone" 아티팩트 + `systemd` + Nginx 기반 배포. 릴리스 디렉터리 전개 후 `current` 심볼릭 전환과 `systemctl restart`로 롤아웃/롤백합니다.
  - API/DB: 불변(immutable) 컨테이너 이미지. 서버에서 `git pull`만으로 앱이 갱신되지 않으며, 이미지를 pull하고(필요 시) Alembic 적용 후 컨테이너 재기동으로 배포합니다.
- 데이터베이스: PostgreSQL 전용(`postgresql+psycopg://` 강제). 전용 Docker 네트워크에서 컨테이너 DNS(예: `sogecon-db`)를 사용하고, `DATABASE_URL`에 고정 IP/localhost는 지양합니다.
- 마이그레이션: DB와 동일 네트워크에서 Alembic 실행. 파괴적 변경은 PR에 다운타임/락 리스크 라벨·메모를 포함합니다.
- 헬스/준비 상태: `/healthz` 200을 기준으로 하며, 재기동 직후 짧은 워밍업 구간(≤90초)은 허용합니다. CI/CD는 이 구간에 재시도를 수행해야 합니다.

### Docker Compose(개발 전용)
- 루트 `compose.yaml`은 로컬 개발 전용입니다. `profiles: ["dev"]`가 필요하고, 포트는 `127.0.0.1`로만 바인딩됩니다.
- 운영 서버에서는 compose dev를 절대 실행하지 마세요. 운영은 `ops/cloud-start.sh`를 사용합니다.
- 보조 스크립트 `scripts/compose-dev-up.sh`가 prod 환경 흔적(`.env.api`의 `APP_ENV=prod`, 실행 중인 `alumni-*` 컨테이너, `sogecon_net` 네트워크 등)을 감지하면 실행을 거부합니다.

### 서버 배포 환경과 플로우
- 웹 스탠드얼론(권장):
  - Next 설정: `apps/web/next.config.js`에 `output: 'standalone'`; Node 24.12.0 고정.
  - Systemd + Nginx: `ops/systemd/sogecon-web.service`, `ops/nginx/nginx-site-web.conf` 샘플 사용.
  - CI/CD: `.github/workflows/web-standalone-deploy.yml`가 아티팩트를 빌드/업로드 후 원격에서 `ops/web-deploy.sh`를 실행(릴리스 디렉터리 → `current` 심볼릭 전환 → 재시작). `systemctl`을 위한 sudoers NOPASSWD 필요(런북 참조).
  - 빌드타임 공개변수: `NEXT_PUBLIC_*`는 빌드 타임 고정 — 변경 시 재빌드 필요.
- 컨테이너 플로우(지원 지속): `infra/api.Dockerfile`, `infra/web.Dockerfile`을 빌드.
  - 빌드 헬퍼: `ops/cloud-build.sh`(`NEXT_PUBLIC_*`는 build args로 전달).
  - 런타임 기동: `ops/cloud-start.sh`(API 127.0.0.1:3001, Web 3000). TLS는 Nginx/Caddy에서 종료.
  - DB 마이그레이션: `ops/cloud-migrate.sh`(Alembic).
  - 이미지 레지스트리: GHCR 권장(`ghcr.io/<owner>/<repo>/alumni-{api,web}:<tag>`). 멀티아치는 `PLATFORMS=linux/amd64 USE_BUILDX=1`.

## 커밋/PR 규칙
- 모든 커밋은 Conventional Commits 형식을 따릅니다: `type(scope): subject`(헤더 72자 제한).
- type: `feat|fix|refactor|perf|test|chore|build|ci|docs`, scope: `api|web|schemas|infra|docs|ops|ci|build`.
- 제목은 명령형·현재 시제로 작성하며 한국어 사용 가능. 자세한 규칙: `docs/commit_message_convention.md`.
- `commit-msg` 훅이 pnpm dlx 기반 고정 버전 `@commitlint/cli`로 즉시 검증하며, CI에서도 최근 커밋을 재검증합니다.
- 비-문서 변경은 `docs/worklog.md` 한 줄 요약 필수, 푸시 시 당일 `docs/dev_log_YYMMDD.md`가 포함되어야 합니다.
 - PR은 `.github/pull_request_template.md` 템플릿을 반드시 사용합니다. Draft 단계에서는 상단 섹션만 채우고, Ready for Review로 전환하기 전에 템플릿 체크리스트를 모두 완료합니다.
- Git 명령 대기 원칙: `git commit`/`git push`(로컬 훅 포함) 중에는 사용자가 멈추라 할 때만 중단하고, 조용해도 최소 3분은 기다립니다. 5분쯤 되면 중단 전에 사용자에게 먼저 묻고 결정하며, 자동 재시도는 금지합니다.

### 계획서(PR 포함) 정책
- ‘계획서만 있는 PR’은 허용하지 않습니다. 계획 문서만 추가하는 PR을 열지 마세요.
- PR에 계획서(예: `docs/plan_YYMMDD.md`, `docs/mN_plan.md`, `docs/execution_plan_*.md`)가 포함되면, 해당 PR에서 계획서의 범위 전부를 구현한 뒤 Ready for Review/병합합니다. 구현 진행 중 Draft는 허용되지만, 코드 없이 병합은 금지합니다.
- PR 제목/설명은 “계획 추가”가 아닌 실제 구현 범위를 반영해야 합니다.

## 언어/커뮤니케이션
- 기본 언어: 레포 내 모든 내부 문서와 코드 주석은 한국어를 원칙으로 합니다.
- 코드 주석: 기본 한국어로 작성합니다. 식별자(변수/함수/타입)는 영어를 사용하되, 도메인 이해에 유리하면 한국어 용어를 허용합니다.
- 사용자 노출 문자열: 특별한 요구가 없는 한 한국어를 기본으로 합니다.
- 커밋/PR: 커밋 메시지와 PR 설명은 한국어로 작성합니다.
- 예외(영문 유지 허용): 외부 라이브러리/벤더 코드, 자동 생성 파일, 라이선스 전문, 프로토콜 상수, 외부 시스템 인용, 외부 API 페이로드/픽스처 등.
- 불가피하게 영어만 가능한 기술 자료를 추가하는 경우, 가능하면 같은 변경 안에 한국어 요약/주석을 함께 남깁니다.
- 레포 가드(Repo Guards)가 다음 시에 실패 처리:
  - 금지된 우회 주석 감지,
  - 600줄 초과 파일,
  - 본 문서의 기타 규칙 위반.

## 예외·면제
- 유일 예외: `apps/api/migrations/env.py`의 `# noqa: E402`.
- 임시 면제는 반드시 이슈 링크/담당자/만료일 포함. 글로벌 설정으로 면제 금지.

## 편집 정책
- 변경은 `agents_base.md`와 `agents_base_kr.md`를 동시에 업데이트하고, AGENTS.md/CLAUDE.md에서 해당 변경을 참조합니다.

## MCP 도구(Serena & Context7)
- Serena MCP(코드 내비게이션):
  - 심층 코드 분석, 리팩터링, 호출/심볼 그래프 추적이 필요할 때 우선적으로 Serena를 사용합니다. 단순 `grep` 검색만으로 구조를 추적하지 말고, 가능하면 Serena 인덱스를 활용합니다.
  - 설치(개인 개발 환경 1회): `uvx --from git+https://github.com/oraios/serena serena --help`
  - 이 레포용 프로젝트 생성(로컬 전용, `.serena/`는 커밋 금지):
    - 레포 루트에서: `serena project create --name sogecon-app --language python --index .`
  - MCP 지원 도구(Claude, Codex CLI, Codex/VSCode 통합 등)에서 사용할 때 MCP 서버 기동:
    - `serena start-mcp-server --transport stdio` (커맨드에는 `--project`를 박지 않는다).
  - 세션 시작 시 한 번은 `activate_project`를 호출해 현재 레포 루트를 Serena 프로젝트로 활성화한다.
  - 코드 분석/리팩터링/참조 추적/심볼·호출 그래프처럼 여러 파일이 엮인 작업은 Serena MCP를 우선 사용하고, 한 파일·몇 줄 정도의 사소한 수정이라면 Serena 호출 없이 바로 수정해도 된다.
  - `.serena/` 디렉터리는 절대경로와 캐시를 포함하므로, 항상 Git 추적 대상에서 제외하고 `.gitignore`에 추가되어 있는지 확인합니다.
- Context7 MCP(공식 문서 조회):
  - Next.js, React, FastAPI, Alembic, PostgreSQL, OpenAI SDK, Cloudflare, Prisma 등 외부 라이브러리 사용법은 Context7으로 최신 공식 문서/예제를 먼저 확인합니다.
  - “X를 어떻게 쓰나?”, “Y의 최신 패턴?” 같은 질문에서는 Context7을 우선하고, 정말 단순 문법이 아니면 기억만 믿지 않습니다.
  - 애매하면 추측 대신 Context7 근거로 답하고, 필요 시 주석·문서·PR 설명에 출처를 남깁니다.

## 개발 환경 & 환경변수(2025‑11‑02)
- API는 로컬 uvicorn으로 실행, PostgreSQL은 Docker Compose로 실행합니다.
  - DB 시작/중지: `make db-up` / `make db-down`
  - 기본 포트: dev `5433`, test `5434`. `infra/.env`에서 다음으로 오버라이드 가능:
    - `DB_DEV_PORT`(기본 `5433`), `DB_TEST_PORT`(기본 `5434`)
  - `.env`의 `DATABASE_URL`이 선택한 dev 포트와 일치해야 합니다.
- CORS 설정: `CORS_ORIGINS`는 JSON 배열 문자열이어야 합니다(예: `["http://localhost:3000"]`).
- Web Push 채택: 표준 Web Push(VAPID). 현 단계에서 FCM은 사용하지 않습니다.
  - `.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  - `apps/web/.env.local`: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - 시크릿은 커밋하지 말고, `*.example` 파일을 최신으로 유지합니다.
- 프라이버시/운영 가드
  - 서버 로그에는 구독 endpoint의 SHA‑256 해시 + 말미 16자만 저장합니다.
  - 404/410 응답 구독은 자동 무효화합니다.
  - 관리자 테스트 발송: `POST /admin/notifications/test` (payload `{ title, body, url? }`).
  - 관리자 UI: `/admin/notifications`에서 발송/요약/최근 로그 확인.

### 서버 배포 환경변수 및 컨테이너 플로우
- 컨테이너 우선: `infra/api.Dockerfile`, `infra/web.Dockerfile`로 API/웹 이미지를 빌드합니다.
  - 빌드 헬퍼: `ops/cloud-build.sh`. Next 공개변수(`NEXT_PUBLIC_*`)는 빌드 인자로 전달합니다.
  - Next의 공개변수는 빌드타임 고정입니다. 변경 시 재빌드가 필요합니다.
- 런타임 기동: `ops/cloud-start.sh`(API 127.0.0.1:3001, Web 3000). TLS는 Nginx/Caddy에서 종료.
- DB 마이그레이션: `ops/cloud-migrate.sh`(Alembic).
- 이미지 레지스트리: GHCR 권장(`ghcr.io/<owner>/<repo>/alumni-{api,web}:<tag>`). 다른 레지스트리도 무방.
- 멀티아치: ARM에서 AMD64 서버용을 빌드할 땐 `PLATFORMS=linux/amd64 USE_BUILDX=1` 사용.
- 환경파일 규칙:
  - 로컬 개발: 루트 `.env`(API가 로컬 실행 시 자동 로드).
  - 서버 런타임: `.env.api`(ENV_FILE/API_ENV_FILE로 주입), `.env.web`(선택; 런타임 토글 용도 제한).
  - 시크릿 커밋 금지. `.dockerignore`로 `.env*`는 빌드 컨텍스트에서 제외하고, `.env.example`/`.env.api.example`/`.env.web.example`만 추적.
- 쿠키 플래그(API): `COOKIE_SAMESITE`(`lax|strict|none`), `COOKIE_SECURE`(bool), `COOKIE_DOMAIN`.
  - 서브도메인 구성: `lax` + `secure` 권장.
  - 별도 도메인(교차 사이트): `none` + `secure`(HTTPS 필수).

## 커밋/PR 규칙(워크로그/데브로그 형식)
- 워크로그(`docs/worklog.md`): 커밋/머지당 1줄 요약만 기록합니다.
  - 형식: `YYYY-MM-DD type(scope): subject — PR #NN[, refs #이슈]` (80–120자)
  - 세부 내용은 PR/이슈에 남기고, 워크로그는 인덱스 성격으로 유지합니다.
- 데브로그(`docs/dev_log_YYMMDD.md`): 하루 3–7줄의 불릿로 요약합니다. 템플릿 `docs/dev_log_TEMPLATE.md` 사용을 권장합니다.

### Next.js 이미지 하드닝
- Dockerfile에서 corepack으로 pnpm 버전 고정(정책: >=10.17.1 <11).
- 런타임에서 `pnpm` 의존 제거: 빌드 단계에 의존성을 포함하고 실행은 `node node_modules/next/dist/bin/next start -p 3000` 형태로 최소화.
- 전역 스토어/심링크 누락 문제를 피하기 위해 워크스페이스 범위 설치를 사용.

### CSP 정책
- 기본: 인라인 스크립트 거부(`script-src 'self'`). Next.js 부트 스니펫이 포함될 수 있음.
- 운영: 전역 `'unsafe-inline'` 금지. 필요한 스니펫만 nonce 또는 hash로 허용(문서화 필수).
- 테스트 임시: 외부 테스트를 위해 Nginx에서 CSP를 임시 완화할 수 있으나, 운영 전 반드시 제거하고 이슈로 추적.

### DB 분리(선택)
- 다른 스택과 공존하는 VPS에서는 전용 Docker 네트워크/DB 컨테이너(예: `sogecon_net`, `sogecon-db`)로 충돌을 회피합니다.
- Alembic 마이그레이션은 DB와 같은 네트워크에서 실행해야 합니다.
