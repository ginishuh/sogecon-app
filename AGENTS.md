# sogecon-app 실행 지침

이 문서는 저장소 자동화 에이전트의 실행 SSOT다. 제품·도메인·운영 세부사항은 아래 문서로 라우팅하고, 이 파일에는 반복 작업에 필요한 계약만 둔다.

## 저장소 구조

- `apps/api`: FastAPI API, 서비스, 저장소, Alembic 마이그레이션
- `apps/web`: Next.js 웹 애플리케이션
- `packages/schemas`: OpenAPI에서 생성한 공유 계약
- `ops`: 배포, CI, 보안 및 운영 스크립트
- `docs`: 제품·아키텍처·운영 SSOT

## 작업별 문서

| 작업 | 먼저 읽을 문서 |
| --- | --- |
| 제품 범위, 화면, 역할, 사용자 흐름 | `docs/Project_overview.md` |
| API/Web 구조, 도메인 경계, 인증 | `docs/architecture.md` |
| UI, 반응형, 접근성 | `docs/design_system.md` |
| PWA, 알림, 구독정보 보호 | `docs/pwa_push.md` |
| 런타임과 의존성 버전 | `docs/versions.md` |
| 보안 정책과 운영 가드 | `docs/security_hardening.md`, `SECURITY.md` |
| CI, 훅, 품질 게이트 | `docs/ci_quality_gates.md` |
| VPS 배포와 롤백 | `docs/agent_runbook_vps.md` |
| 커밋 형식 | `docs/commit_message_convention.md` |

## 구현 불변조건

### API와 데이터

- 계층은 Router → Service → Repository/DB 순서다. Router에서 ORM을 직접 다루지 않는다.
- 운영 데이터베이스는 PostgreSQL과 `postgresql+psycopg://` 연결을 사용한다.
- 스키마 변경은 Alembic 마이그레이션으로 관리한다.
- 인증·권한 검사는 서버에서 수행하고, 오류 응답은 `docs/architecture.md`의 계약을 따른다.

### Web과 사용자 경험

- 계층은 UI → hook/service → shared API client 순서다.
- 사용자 문구는 한국어를 기본으로 하며 내부 구현 용어를 노출하지 않는다.
- 모바일 레이아웃, 키보드 조작, 포커스 표시, 연결된 label, 오류 후 다음 행동을 함께 검증한다.
- 인증정보, 연락처, 푸시 구독정보와 업로드 데이터는 민감정보로 취급한다.

### 로컬 브라우저 E2E

- 로컬 Web의 실제 브라우저 검증은 `playwright-cli` Agent CLI를 기본 브라우저 표면으로 사용한다. 저장소에 설치된 `.agents/skills/playwright-cli/SKILL.md`와 그 references를 따른다.
- `pnpm -C apps/web e2e`는 Puppeteer 기반 자동 회귀 suite이고, visible browser 증거를 대체하지 않는다. 두 결과를 `headless 자동화`와 `Playwright CLI visible browser`로 구분해 보고한다.
- CLI가 없으면 Node 20+ 환경에서 `npm install -g @playwright/cli@latest`와 `playwright-cli install-browser`를 실행한다. 작업공간 skill은 `playwright-cli install --skills=agents`로 초기화한다.
- PR CI의 자동 E2E(`pnpm -C apps/web e2e`)는 격리된 deterministic mock API를 사용할 수 있다. 반면 실제 로컬 브라우저 E2E는 mock을 사용하지 않고, 로컬 production Web(`http://127.0.0.1:3000`)과 실제 local dev API·DB를 연결해 검증한다. 운영 URL·운영 계정·운영 데이터는 사용자의 명시적 요청 없이는 접근하지 않는다.
- `PLAYWRIGHT_CLI_SESSION` 또는 `-s=<semantic-name>`으로 admin/member/anonymous 브라우저 세션을 분리한다. 권한 경계 테스트는 세션 전환만으로 추정하지 말고, `/auth/session` 응답과 실제 화면을 함께 확인한다.
- 상호작용 테스트는 snapshot의 element ref 또는 접근성 locator를 사용해 실제 `click`·입력·이동을 수행한다. href 확인 후 URL을 직접 입력해 click 성공으로 대체하지 않는다. 뷰포트 밖 요소는 먼저 scroll/resize한 뒤 click한다.
- draft 공개 차단은 anonymous 세션에서 API status(401/404)와 사용자 화면(404/not found)을 모두 확인한다. 결과는 PASS, FAIL, INCONCLUSIVE로 보고하고, 직접 이동·대체 경로·로그아웃 미검증을 숨기지 않는다.

### API 계약

- API 계약 변경 시 OpenAPI와 TypeScript DTO를 함께 생성한다.
- `packages/schemas/openapi.json`과 `packages/schemas/index.d.ts`는 생성 결과로 갱신한다.

## 작업 원칙

- 요청을 재현 가능한 완료 기준으로 바꾸고, 필요한 범위만 수정한다.
- 기존 작업 트리 변경과 요청 밖의 파일을 보존한다.
- 문제의 원인, 수정, 회귀 검증을 한 작업 단위 안에서 연결한다.
- 동작·계약 변경에는 자동화 테스트를 추가하거나 기존 테스트로 근거를 남긴다.
- 코드·스크립트 변경은 해당 날짜의 `docs/dev_log_YYMMDD.md`에 기록한다.

## 검증

변경 범위에 맞는 최소 집합을 실행하고, 계약·보안·배포 영향이 있으면 관련 검증을 추가한다.

```bash
# 저장소 정책과 버전
.venv/bin/python ops/ci/guards.py
.venv/bin/python ops/ci/check_versions.py

# API
.venv/bin/ruff check apps/api
.venv/bin/python -m pyright --project pyrightconfig.json
.venv/bin/pytest -q

# Web
pnpm -C apps/web lint
pnpm -C apps/web test
pnpm -C apps/web build

# API 계약 변경
.venv/bin/python scripts/export_openapi.py
pnpm -C packages/schemas run gen-dts
git diff --exit-code packages/schemas/openapi.json packages/schemas/index.d.ts

# Git 훅
bash ops/ci/test_githooks.sh
```

## 실행 환경 경계

- 로컬 개발은 루트 `compose.yaml`의 `dev` profile과 `make dev-up`을 사용한다.
- 운영 배포는 `docs/agent_runbook_vps.md`의 빌드·마이그레이션·재시작·헬스체크 순서를 따른다.
- `/srv/<repo>` 운영 작업은 대상 경로, remote, 백업·롤백 경로를 확인한 뒤 실행한다.
- 비밀값, 키, 인증서, 토큰, 데이터베이스 백업은 저장소에 기록하지 않는다.

## 권한 경계

- 조회, 진단, 로컬 검증은 작업 범위 안에서 진행한다.
- 배포, 운영 데이터 변경, 외부 메시지, 이슈/PR 상태 변경, 머지에는 사용자의 명시적 요청이 필요하다.
- 파괴적 데이터 작업은 대상·영향·복구 경로를 확인한 뒤 실행한다.

## 완료 보고

다음 순서로 간결하게 보고한다.

1. 결과와 사용자 영향
2. 변경 파일 또는 핵심 변경점
3. 실행한 검증과 결과
4. 남은 위험, 미검증 항목, 다음 단계
