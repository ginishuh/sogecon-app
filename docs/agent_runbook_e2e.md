# E2E 실행 runbook (에이전트)

sogecon-app 전용 E2E **상세 실행 SSOT**다. 의사결정·금지 규칙은 루트 `AGENTS.md`에 두고, 이 문서는 에이전트가 실제로 돌릴 때 따른다.

| 문서 | 역할 |
| --- | --- |
| `AGENTS.md` | 트랙 선택·금지·보고 계약 |
| 이 문서 | live/mock 실행 절차·포트·복원 |
| `.github/workflows/e2e.yml` | mock regression **실행 authority** (CI) |
| `docs/ci_quality_gates.md` | CI gate 정책 설명 |
| `.agents/skills/playwright-cli/` | Playwright CLI **일반** 사용법 (upstream/tool copy) |

`.agents/skills/playwright-cli`는 `playwright-cli install --skills=agents`로 초기화·재설치될 수 있다. **sogecon 고유 E2E 정책은 skill에 넣지 않는다.**

---

## 1. 두 축을 혼동하지 말 것

| 축 | 질문 | 값 예 |
| --- | --- | --- |
| **Live 여부** | API·DB가 mock인가 real인가? | live = real local API + PostgreSQL |
| **Web runtime** | Web이 dev server인가 production start인가? | `make dev-up` → `pnpm dev` (Next dev) |

- **Live product E2E**는 production Web이 **필수가 아니다.** 기능·권한·업로드·오류 semantics는 **real dev Web + real API/DB**로도 유효하다.
- **production build/start**는 Web 산출물·빌드타임 env·SSR parity가 변경에 중요할 때만 별도로 수행한다 (`ops/deploy_web.md`, CI mock 경로).
- `make dev-up`은 host **uvicorn** API + **`pnpm dev` Web** + Docker **postgres**다. production Web이 **아니다**.

---

## 2. 트랙 정의

### 2.1 Live product E2E

| 항목 | 내용 |
| --- | --- |
| 기본 도구 | `playwright-cli` (`.agents/skills/playwright-cli/SKILL.md`) |
| 검증 경계 | **real Web → real local API → local DB**, mock 없음 |
| Authority | **mock이 아닌 실제 product stack**을 통과하는지 (visible/headed 여부는 기본 authority 아님) |
| OS 창 검증 | OS·브라우저 창 자체가 검증 대상일 때만 headed/visible을 **별도** 요구 |

### 2.2 Mock regression E2E

| 항목 | 내용 |
| --- | --- |
| 실행 | `pnpm -C apps/web e2e` (`apps/web/vitest.config.e2e.mts`, `apps/web/e2e/*.spec.ts`) |
| 구현 | Vitest + Puppeteer/CDP + deterministic mock API (`apps/web/e2e/mock-api-server.mjs`) |
| 역할 | Web regression / **CI gate** — real API·DB product semantics **대체 불가** |
| 상호 관계 | live E2E를 했다고 mock regression을 자동 생략하지 않는다. 변경 범위에 따라 **둘 다** 필요할 수 있다 |

---

## 3. `:3000` / `:3001` runtime 확인 (공통 preflight)

E2E 전 **listener 소유자**를 확인하고, 시작 전 상태를 기록한다.

```bash
make dev-status                    # host api/web pid 파일·리슨 힌트
ss -ltnp | grep -E ':3000|:3001'   # 또는 lsof -i :3001 -sTCP:LISTEN
docker compose --profile dev ps    # api_dev / web_dev 여부
```

| `:3001` 소유 후보 | 식별 | 비고 |
| --- | --- | --- |
| Host real API | `make api-status`, `.api-dev.pid`, uvicorn 프로세스 | `make api-stop`이 **이것만** 종료 |
| Docker `api_dev` | `compose.yaml` `127.0.0.1:3001:3001`, `docker compose ps` | `make api-stop`으로는 **안 멈춤** |
| Mock API | `node apps/web/e2e/mock-api-server.mjs`, `E2E_MOCK_API_PORT` 기본 `3001` | CI·로컬 mock regression |
| 기타 | `ss`/`lsof`로 PID·프로세스명 확인 | |

| `:3000` 소유 후보 | 식별 |
| --- | --- |
| Host dev Web | `apps/web/.web-dev.pid`, `pnpm dev` |
| Docker `web_dev` | compose publish `127.0.0.1:3000:3000` |
| Production `next start` | CI mock job, 로컬 parity 실행 시 |

**규칙:**

- mock regression과 **real API는 `:3001`을 동시에 점유하지 않는다.** mock 실행 중 real API를 다른 방식으로 추가로 띄우거나 섞지 않는다.
- CI-parity mock regression(`pnpm start` production Web)과 **dev Web은 `:3000`을 동시에 점유하지 않는다.** live E2E 직후 `make dev-up`으로 `:3000`에 `pnpm dev`가 살아 있으면 mock 전환 시 **EADDRINUSE**가 난다.

### 3.1 시작 전·종료 후 복원 (필수 semantics)

트랙 전환(live ↔ mock)마다 **`:3000`과 `:3001` 둘 다** 시작 전 소유자를 기록하고, mock CI-parity 시작 전에 listener를 비운 뒤, 종료 시 **시작 전 상태로만** 복원한다.

#### 기록 (시작 전)

| 포트 | 소유 후보 | 기록 예 |
| --- | --- | --- |
| `:3000` | 없음 / host dev Web / Docker `web_dev` / (이미 production `next start`) | `host_web`, `docker_web_dev`, `none` |
| `:3001` | 없음 / host real API / Docker `api_dev` / mock | `host_api`, `docker_api_dev`, `none` |

#### mock CI-parity 시작 전 suspend (`:3000` + `:3001`)

| 포트 | 현재 소유 | mock 전 처리 |
| --- | --- | --- |
| `:3000` | host dev Web (`pnpm dev`, `.web-dev.pid`) | `make web-stop` |
| `:3000` | Docker `web_dev` | `docker compose --profile dev stop web_dev` |
| `:3000` | 없음 | 그대로 |
| `:3001` | host real API (uvicorn, `.api-dev.pid`) | `make api-stop` |
| `:3001` | Docker `api_dev` | `docker compose --profile dev stop api_dev` |
| `:3001` | 없음 | 그대로 |

이후 §5.1 순서대로 mock API(`:3001`) + production `pnpm start`(`:3000`)를 기동한다.

#### 종료·실패·중단 시 restore (둘 다)

1. mock API·production Web PID를 먼저 종료한다 (`trap`/`finally` 권장).
2. **시작 전에 기록한 소유자만** 복원한다. 원래 없던 runtime은 **새로 켜지 않는다.**

| 시작 전 기록 | 복원 |
| --- | --- |
| `host_web=yes` | `make web-start` |
| `docker_web_dev=yes` | `docker compose --profile dev up -d web_dev` |
| `host_api=yes` | `make api-start` |
| `docker_api_dev=yes` | `docker compose --profile dev up -d api_dev` |
| `none` | 아무 것도 시작하지 않음 |

**주의:** `make api-stop`/`make web-stop`은 **host pid 파일 기반**이다. Docker `api_dev`/`web_dev`는 `make *-stop`만으로는 안 멈출 수 있다. 반대로 `make api-start`/`make web-start`는 **원래 host runtime이 없었던 환경**에서 잘못된 복원이다.

예시 (문서용 — live `make dev-up` 직후 mock CI-parity로 전환):

```bash
# 시작 전 상태 기록 (예: host_web=yes, host_api=yes, docker_*=no)
make web-stop
make api-stop
MOCK_PID=""
WEB_PID=""
cleanup() {
  if [ -n "$WEB_PID" ]; then kill "$WEB_PID" 2>/dev/null || true; fi
  if [ -n "$MOCK_PID" ]; then kill "$MOCK_PID" 2>/dev/null || true; fi
  # 시작 전 host runtime이 있었을 때만:
  make api-start
  make web-start
}
trap cleanup EXIT INT TERM
node apps/web/e2e/mock-api-server.mjs &
MOCK_PID=$!
# build + pnpm -C apps/web start → WEB_PID 기록
# ... pnpm -C apps/web e2e ...
```

Docker `api_dev`/`web_dev`가 점유 중이었다면 `docker compose --profile dev stop api_dev web_dev` 후 mock, 복원 시 `up -d`로 각각 되돌린다.

---

## 4. Live product E2E 절차

Playwright CLI 일반 명령·snapshot·ref는 **skill**을 따른다. 여기서는 sogecon 고유 계약만 적는다.

### 4.1 스택 선택

| 목적 | 권장 스택 |
| --- | --- |
| 일반 기능·auth·업로드·권한 | `make dev-up` (host API + `pnpm dev` Web + dev DB) |
| Web build/SSR parity | `NEXT_PUBLIC_WEB_API_BASE=... pnpm -C apps/web build && start` + real API (`ops/deploy_web.md`) |

`make dev-up` 구성 (`Makefile`):

- API: host `uvicorn` `:3001` (`api-start`)
- Web: host `pnpm -C apps/web dev` `:3000` (`web-start`)
- DB: Docker `postgres` `localhost:5433`

`compose` `api_dev`/`web_dev`와 **혼동하지 않는다.**

### 4.2 Preflight

```bash
make dev-status
curl -fsS http://localhost:3000/ >/dev/null    # Web
curl -fsS http://localhost:3001/healthz | grep -q '"ok":true'   # API — /health 아님
```

- `apps/web/.env.local`의 `NEXT_PUBLIC_WEB_API_BASE`와 브라우저 **origin**을 맞춘다.
- 기본 CORS (`apps/api/config.py`): `http://localhost:3000`. dev 경로에서는 브라우저를 **`http://localhost:3000`** 으로 연다 (`localhost` ≠ `127.0.0.1`).
- `127.0.0.1`을 쓰려면 `CORS_ORIGINS`와 Web API base를 **같은 loopback 호스트**로 맞춘다.

### 4.3 실행 원칙

- **mock API·mock route 사용 금지.**
- `playwright-cli -s=<name>`으로 admin/member/anonymous 등 **세션 분리** (skill 참고).
- 실제 `click`·입력·업로드 등 **사용자 진입점**을 수행한다. 화면만 보고 권한을 추정하지 않는다.
- 인증·권한: `/auth/session` 응답과 화면을 함께 확인한다.
- persistence가 핵심이면 API 또는 DB **authoritative readback**으로 effect를 확인한다.
- React controlled input은 `fill`만으로 submit이 활성화되지 않을 수 있다 — `type`·`click` 등 실제 입력 이벤트를 사용한다.
- curl로 API(3001)에만 만든 쿠키를 Web(3000) 세션에 주입하지 않는다.
- **운영 URL·운영 계정·운영 DB**는 사용자 **명시 지시 없이** 사용하지 않는다.

### 4.4 결과 보고

- 시나리오별 **PASS / FAIL / INCONCLUSIVE**.
- mock regression 결과와 **구분**해 보고한다.
- 직접 URL 이동·우회·로그아웃 미검증은 숨기지 않는다.
- 이슈/PR에 남길 때 live mock 회귀와 트랙을 명시한다.

---

## 5. Mock regression E2E 절차

**Executable authority:** `.github/workflows/e2e.yml` (현재 workflow 기준).

### 5.1 CI 순서 (workflow 그대로)

1. `pnpm -C apps/web install --frozen-lockfile` (`PNPM_ALLOW_RUN_SCRIPTS: puppeteer`)
2. Chrome setup (`browser-actions/setup-chrome`)
3. **Web production build:** `pnpm -C apps/web build`
   - env: `WEB_BASE_URL=http://127.0.0.1:3000`, `NEXT_PUBLIC_WEB_API_BASE=http://127.0.0.1:3001`, `WEB_BUILD_ALLOW_INSECURE_LOCAL_API=1`
4. **Mock API** background: `node apps/web/e2e/mock-api-server.mjs` → `:3001`
5. **Web production start:** `pnpm -C apps/web start` → `:3000`
6. Health wait: `http://127.0.0.1:3001/healthz`, then `http://127.0.0.1:3000`
7. **Run:** `pnpm -C apps/web e2e` with `PUPPETEER_EXECUTABLE_PATH`
8. **Cleanup (always):** kill `web.pid`, `mock-api.pid`

Mock API는 `127.0.0.1:3001`에 바인드한다 (`E2E_MOCK_API_PORT` 기본 `3001`). 세션 제어: `E2E_MOCK_API_CONTROL_URL` → `POST .../__e2e/config` (`apps/web/e2e/utils/mockServer.ts`).

### 5.2 로컬에서 CI에 가깝게 돌릴 때

1. §3 preflight — **`:3000`과 `:3001` listener 소유자 확인·기록**.
2. §3.1 suspend — **`:3000` dev Web**(host `make web-stop` 또는 Docker `web_dev`)과 **`:3001` real API**(host `make api-stop` 또는 Docker `api_dev`)를 mock 전에 제거.
3. CI와 동일 env로 **build → mock → start → e2e** (§5.1). **`pnpm start` 전에 `pnpm build`가 성공했는지 확인**한다. 한 줄에 `build && ... & start`를 섞으면 build가 끝나기 전에 start가 떠 `production-start-no-build-id`로 실패할 수 있다.
4. **Chrome/Puppeteer:** CI는 `browser-actions/setup-chrome` + `PUPPETEER_EXECUTABLE_PATH`를 주입한다. 로컬은 아래 중 하나를 쓴다.
   - (권장) 시스템 Chrome: `export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable` (WSL/Linux에서 `which google-chrome-stable`로 확인)
   - Puppeteer 번들 Chrome: `PNPM_ALLOW_RUN_SCRIPTS=puppeteer pnpm -C apps/web install` 후 `~/.cache/puppeteer`에 바이너리가 생겼는지 확인. pnpm 10은 기본적으로 install script를 막아 `Could not find Chrome`이 날 수 있다.
5. `trap`/cleanup으로 mock·production web 종료.
6. §3.1 restore — **`:3000`과 `:3001` 모두** 시작 전 상태로만 복원 (원래 없던 runtime은 새로 켜지 않음).

로컬에서 `next dev`를 켠 채 mock만 바꿔 `pnpm e2e`를 돌리면 CI와 **환경이 다르다** (일부 spec 실패는 regression defect가 아닐 수 있음). authoritative 실패 판단은 **CI workflow 조건**을 우선한다.

**D10 등 CI/품질 gate-only 변경**은 mock regression E2E(§5.1)로 충분하다. live `playwright-cli`는 product semantics·업로드·auth 변경 시에만 추가한다.

### 5.3 한계 (명시)

- Upload quota·rate limit·DB migration·multi-user 동시성 등 **real API semantics**는 이 트랙으로 증명하지 않는다 → live product E2E 또는 API tests (`pytest`).

---

## 6. 트랙 선택 (빠른 참조)

| 사용자/작업 의도 | 트랙 |
| --- | --- |
| 업로드·auth·권한·실제 DB effect | Live product (`playwright-cli`) |
| PR Web UI 회귀·onboarding·admin preview 등 mock spec | Mock regression (`pnpm e2e`, CI parity) |
| 둘 다 | 순서 분리 + `:3000`/`:3001` 소유 교체 + 복원 |

---

## 7. 관련 명령 (검증 블록은 `AGENTS.md`)

```bash
# Live preflight 예
make dev-status
curl -fsS http://localhost:3001/healthz

# Mock (CI env 예 — workflow e2e.yml 참고)
# :3000 dev Web + :3001 real API 비운 뒤에만 (§3.1)
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable   # 로컬 WSL/Linux 예시
WEB_BASE_URL=http://127.0.0.1:3000 \
NEXT_PUBLIC_WEB_API_BASE=http://127.0.0.1:3001 \
WEB_BUILD_ALLOW_INSECURE_LOCAL_API=1 \
pnpm -C apps/web build
# build 성공 후: mock-api-server.mjs → pnpm start → pnpm -C apps/web e2e (§5.1)
```

Playwright CLI 일반 설치·사용법은 `.agents/skills/playwright-cli/SKILL.md`를 따른다.
