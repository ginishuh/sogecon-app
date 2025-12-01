# 서강대학교 경제대학원 총동문회 앱 (Segecon App)

공개 웹 애플리케이션 모노레포입니다. 브랜드는 **서강대학교 경제대학원 총동문회**입니다.

![Static Badge](https://img.shields.io/badge/Python-3.12.3-3776AB?logo=python&logoColor=white)
![Static Badge](https://img.shields.io/badge/Node-22.21.1-339933?logo=node.js&logoColor=white)
![Static Badge](https://img.shields.io/badge/pnpm-10.17.1-F69220?logo=pnpm&logoColor=white)
![Static Badge](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Static Badge](https://img.shields.io/badge/FastAPI-0.120-009688?logo=fastapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<details>
<summary>EN Summary</summary>

Public monorepo for the Sogang GS Economics Alumni web service. Contains a Next.js web app, a FastAPI backend, and an OpenAPI→TypeScript DTO tool. See Quickstart and docs below.

</details>

---

## 목차
- 소개 및 특징
- 저장소 구조
- 사전 요구사항
- 빠른 시작(로컬 개발)
- 환경 변수 가이드(로컬/서버)
- 배포 가이드(컨테이너/VPS)
- 테스트 · 품질 · CI
- 커밋/PR 규칙
- 보안 · 개인정보
- 자주 묻는 질문(트러블슈팅)
- 라이선스

## 소개 및 특징
- 모노레포: Next.js 프런트(`apps/web`), FastAPI 백엔드(`apps/api`), 스키마 툴(`packages/schemas`).
- 로컬 친화: Dockerized Postgres, `.venv` 표준, Makefile 유틸.
- 모바일 웹 우선 · PWA/Web Push: 설치형 웹앱, 알림. 자세한 설계는 `docs/pwa_push.md`.
- 품질 자동화: Git 훅/CI로 `ruff`·`pyright`·`pytest`·`pnpm build`·`gitleaks` 실행.
- 표준화 버전: 런타임/도구 버전은 `docs/versions.md`에서 단일화 관리(SSOT).

## 저장소 구조
```
apps/
  web/     # Next.js(App Router)
  api/     # FastAPI
packages/
  schemas/ # OpenAPI → TypeScript DTO 생성
infra/     # Dockerfiles and deployment scripts (no dev compose)
ops/       # CI/자동화 스크립트
docs/      # 아키텍처/버전/보안/작업로그 문서
```

## 사전 요구사항
- Python 3.12.3
- Node.js 22.17.1, pnpm 10.17.1 (`corepack enable` 권장)
- Docker Desktop 또는 호환 런타임(개발용 Postgres)

## 빠른 시작(로컬 개발)
0) `.env` 준비: `.env.example`를 복사 후 필요한 값을 채웁니다.
```bash
cp .env.example .env
```

1) 데이터베이스(PostgreSQL 필수)
```bash
make db-up  # docker compose --profile dev up -d postgres postgres_test
```

2) API 서버(.venv 권장)
```bash
make venv && make api-install
make info-venv
alembic -c apps/api/alembic.ini upgrade head
make api-dev  # uvicorn apps.api.main:app --reload --port 3001
```

3) 웹 앱(Next.js)
```bash
corepack enable
pnpm -C apps/web install
make web-dev  # http://localhost:3000
```

4) 스키마 타입 생성(선택)
```bash
pnpm -C packages/schemas install
make schema-gen
```

> English quickstart: (1) `make db-up` (2) `make venv && make api-install && alembic ... && make api-dev` (3) `corepack enable && pnpm -C apps/web i && make web-dev` (4) `pnpm -C packages/schemas i && make schema-gen`.

### 로컬 실행 모드(요약)

두 가지 모드가 있습니다 — 목적에 맞게 선택하세요.

- 개발(dev 프로필, 핫리로드) — 기본 권장
  - 올리기: `docker compose --profile dev up -d`
  - 내리기: `docker compose --profile dev down`
  - 특성: `api_dev(uvicorn --reload)` + `web_dev(Next dev/HMR)`로 변경 즉시 반영.
  - 주의: dev 프로필 전용입니다(운영 서버에서 실행 금지).

- 운영 미러 모드(VPS와 동일 흐름 검증)
  - 사전: `docker network create sogecon_net || true`, `.env.api` 준비(`APP_ENV=prod`, 강한 `JWT_SECRET`, `DATABASE_URL=...@sogecon-db:5432/...`).
  - 실행(예시):
    - `bash scripts/deploy-vps.sh -t <TAG> -p ghcr.io/<owner>/<repo> \
      --network sogecon_net --uploads "$PWD/uploads" -e .env.api -w "" \
      --api-health http://localhost:3001/healthz --web-health http://localhost:3000/`
  - 특성: GHCR에 빌드된 이미지를 그대로 실행(배포 동작·보안·CORS 검증에 적합).

모드 전환
- dev → 미러: `docker compose --profile dev down` 후 위 “운영 미러 모드” 실행
- 미러 → dev: `docker rm -f alumni-api alumni-web || true` 후 `docker compose --profile dev up -d`

참고
- 루트 `compose.yaml`의 dev 프로필은 로컬 개발 전용입니다.
- VPS 표준 배포 경로는 `docs/agent_runbook_vps*.md`와 `ops/cloud-*.sh` 스크립트를 따르세요.

## 환경 변수 가이드(로컬/서버)
- 로컬 개발(API)
  - 루트 `.env`를 자동 로드합니다(`apps/api/config.py`).
  - `DATABASE_URL` 기본은 개발용 Postgres(`postgresql+psycopg://...:5433/...`).
  - 강제 정책: SQLite 등 비-PostgreSQL 백엔드는 지원하지 않습니다.
  - CORS: `CORS_ORIGINS`는 JSON 배열 문자열(예: `["http://localhost:3000"]`).
- 웹(Next.js)
  - `NEXT_PUBLIC_*`는 “빌드타임 고정”입니다. 값 변경 시 반드시 재빌드가 필요합니다.
  - 대표 키: `NEXT_PUBLIC_WEB_API_BASE`(API 베이스), `NEXT_PUBLIC_SITE_URL`(공개 URL), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- 서버 배포(API/Web)
  - API 런타임 env 파일: `.env.api`(루트), 예시는 `.env.api.example` 참고.
  - Web 런타임 env 파일(선택): `.env.web`(예시는 `.env.web.example`). 단, `NEXT_PUBLIC_*`는 빌드타임 주입이 원칙.
  - 쿠키 옵션(교차 도메인 대비): `COOKIE_SAMESITE`(`lax|strict|none`), `COOKIE_SECURE`(bool), `COOKIE_DOMAIN`.
    - 같은 상위도메인의 서브도메인: `lax` + `secure`
    - 별도 도메인으로 전환: `none` + `secure`(HTTPS 필수)
  - 샘플/전체 목록: `.env.example`, `.env.api.example`, `.env.web.example` 참고.

## 테스트 · 품질 · CI
- 훅 활성화: `git config core.hooksPath .githooks`.
- Python: `ruff`(복잡도/스타일) · `pyright`(strict) · `pytest -q`.
- Web: `eslint`(`next/core-web-vitals`) · `tsc --noEmit` · `pnpm -C apps/web build`.
- 단축키: `make test-api`, `make schema-gen` 등은 `Makefile` 참고.
- CI: `.github/workflows/ci.yml`가 버전 고정/정적검사/빌드/보안 스캔을 수행합니다. Lighthouse, E2E, DTO 검증 워크플로도 제공됩니다.

## 커밋/PR 규칙
- Conventional Commits 필수: `type(scope): subject`(72자 이내). 타입/스코프는 `docs/commit_message_convention.md` 참고.
- 비-문서 변경 시: `docs/worklog.md` 1줄 요약, 푸시 시 당일 `docs/dev_log_YYMMDD.md` 포함.
- PR 템플릿 사용: `.github/pull_request_template.md`. Draft에서는 상단만, Ready 전 체크리스트 완비.
- 에이전트/코드 품질 규칙: `AGENTS.md`, `docs/agents_base*.md` 우선.

## 보안 · 개인정보
- 보안 이슈: `SECURITY.md`를 따르고, `security@trr.co.kr`로 먼저 보고.
- Web Push 구독 정보는 민감 데이터로 취급하고 로그에 식별정보를 노출하지 않습니다. 상세 운영 가이드는 `docs/pwa_push.md`.
- 코드 내 시크릿 금지. 실제 비밀은 `.env*` 파일에 두고 예제는 `.env.example`/`.env.api.example`/`.env.web.example`로 공유.

## 자주 묻는 질문(트러블슈팅)
- 포트 충돌(5433/5434): `.env`의 `DB_DEV_PORT/DB_TEST_PORT` 변경 후 `make db-down && make db-up`.
- `uvicorn`/`pytest` 못 찾음: 가상환경이 없거나 다른 venv 사용 중입니다. `make venv && make api-install` 후 재시도.
- `pnpm` 명령 없음: `corepack enable` 실행 후 터미널 재시작 또는 `pnpm -v`로 확인.
- API/Web 백그라운드 실행/중지: `make dev-up` / `make dev-down`(로그는 `logs/` 참조).

## 라이선스
MIT © 2025 Traum — 자세한 내용은 `LICENSE` 참조.

---
문서 기본 언어는 한국어입니다. 사용자 노출 텍스트/README 역시 한국어를 우선합니다. 필요한 경우 간단한 영어 요약을 함께 제공합니다.
## 배포 가이드(Prod: Web standalone + systemd, API/DB 컨테이너)

권장 운영 구성은 “Web(Next.js) 비컨테이너 + systemd + Nginx”이며, API/DB는 컨테이너로 유지합니다. 기존 “Web 컨테이너” 경로도 병행 지원하지만, 단순성·관찰성·롤백 속도 측면에서 standalone 구성을 권장합니다.

- 원클릭(권장): GitHub Actions → `web-standalone-deploy` → environment=`prod`
  - CI가 `apps/web`을 `output: 'standalone'`으로 빌드 → 아카이브 업로드(SCP) → 원격에서 `ops/web-deploy.sh` 실행(릴리스 디렉터리 전개 + `current` 링크 전환 + systemd 재시작) → 헬스체크
  - 서버 1회 준비: Node 22.17.1(asdf), `/srv/www/sogecon/releases`, Nginx 프록시(127.0.0.1:3000), systemd 유닛(`ops/systemd/sogecon-web.service`) 설치, sudoers(NOPASSWD) 설정
  - 상세: `docs/agent_runbook_vps.md` (KR) / `_en.md` (EN)

- TL;DR(컨테이너 경로 — 병행 지원)
  - 순서: 태그 선택 → 이미지 pull → Alembic → 재기동 → 헬스체크(최대 90초 재시도)
  - 수동 예시(서버):
    ```bash
    TAG=<sha>
    docker pull ghcr.io/<owner>/<repo>/alumni-api:$TAG
    docker pull ghcr.io/<owner>/<repo>/alumni-web:$TAG
    docker network inspect sogecon_net >/dev/null 2>&1 || docker network create sogecon_net
    API_IMAGE=ghcr.io/<owner>/<repo>/alumni-api:$TAG ENV_FILE=.env.api DOCKER_NETWORK=sogecon_net ./ops/cloud-migrate.sh
    API_IMAGE=ghcr.io/<owner>/<repo>/alumni-api:$TAG WEB_IMAGE=ghcr.io/<owner>/<repo>/alumni-web:$TAG \
      DOCKER_NETWORK=sogecon_net API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web ./ops/cloud-start.sh
    # 헬스(2xx 기대, 재기동 직후 5xx 허용 구간: ≤90s)
    for i in {1..90}; do code=$(curl -sf -o /dev/null -w "%{http_code}" https://api.<도메인>/healthz || true); [ "$code" = 200 ] && break; sleep 1; done
    for i in {1..90}; do code=$(curl -sf -o /dev/null -w "%{http_code}" https://<도메인>/ || true); [ "$code" = 200 ] && break; sleep 1; done
    ```
  - 원클릭: `scripts/deploy-vps.sh -t <tag> --network sogecon_net --api-health https://api.<도메인>/healthz --web-health https://<도메인>/`

### Web standalone(systemd) 수동 절차(요약)
서버에 레포가 `/srv/sogecon-app`로 클론되어 있다고 가정합니다. CI 없이 수동으로 전개하려면:
```bash
# 1) 로컬/CI에서 빌드
pnpm -C apps/web install && pnpm -C apps/web build  # output: 'standalone'
tar -C . -czf web-standalone-<sha7>.tar.gz \
  apps/web/.next/standalone apps/web/.next/static apps/web/public

# 2) 서버 업로드 후 전개
scp web-standalone-<sha7>.tar.gz <user>@<host>:/srv/sogecon-app/_tmp/
ssh <user>@<host>
cd /srv/sogecon-app/_tmp && mkdir -p web-standalone-<sha7> && \
  tar -xzf web-standalone-<sha7>.tar.gz -C web-standalone-<sha7>

# 3) 릴리스 전환 + 재시작
cd /srv/sogecon-app
CI=1 RELEASE_BASE=/srv/www/sogecon SERVICE_NAME=sogecon-web \
REPO_ROOT=/srv/sogecon-app/_tmp/web-standalone-<sha7> bash ./ops/web-deploy.sh
```
참고 파일: `ops/web-deploy.sh`, `ops/web-rollback.sh`, `ops/systemd/sogecon-web.service`, `ops/nginx/sogecon.conf`, `ops/nginx/nginx-site-web.conf`

- 컨테이너 빌드/푸시(GHCR 권장)
  - AMD64 빌드: 
    ```bash
    IMAGE_PREFIX=ghcr.io/<owner>/<repo> \
    NEXT_PUBLIC_SITE_URL=https://sogecon.wastelite.kr \
    NEXT_PUBLIC_WEB_API_BASE=https://api.sogecon.wastelite.kr \
    PUSH_IMAGES=1 ./ops/cloud-build.sh
    ```
  - ARM 맥에서 AMD64 서버용: `PLATFORMS=linux/amd64 USE_BUILDX=1` 추가
- Web 이미지 빌드 주의(Next.js + pnpm)
  - `corepack`으로 pnpm 버전 고정: Dockerfile에서 `corepack prepare pnpm@10.17.1 --activate` 사용.
  - 런타임에서 `pnpm`이 필요 없도록 빌드 단계에서 의존성을 포함시킵니다.
  - 실행 커맨드: `node node_modules/next/dist/bin/next start -p 3000`(런타임 최소화).
- 서버 실행(예: `/srv/segecon`에 클론되어 있다고 가정)
  ```bash
  # 1) 이미지 풀
  docker pull ghcr.io/<owner>/<repo>/alumni-api:<tag>
  docker pull ghcr.io/<owner>/<repo>/alumni-web:<tag>

  # 2) 마이그레이션(최초/스키마 변경 시)
  API_IMAGE=ghcr.io/<owner>/<repo>/alumni-api:<tag> \
  ENV_FILE=.env.api ./ops/cloud-migrate.sh

  # 3) 재기동
  API_IMAGE=ghcr.io/<owner>/<repo>/alumni-api:<tag> \
  WEB_IMAGE=ghcr.io/<owner>/<repo>/alumni-web:<tag> \
  API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  ./ops/cloud-start.sh
  ```
- 원클릭 스크립트(서버): `scripts/deploy-vps.sh -t <tag> --api-health https://api.<도메인>/healthz --web-health https://<도메인>/`
- 리버스 프록시: Nginx 예시는 `ops/nginx-examples/` 참고(127.0.0.1:3000/3001로 프록시, TLS는 Nginx에서 처리).

### 보안 헤더/CSP 주의
- 운영 기본: `apps/web/middleware.ts`에서 요청마다 nonce를 생성하고 `Content-Security-Policy` 헤더를 주입합니다. 프로덕션(`NODE_ENV=production` 및 `NEXT_PUBLIC_RELAX_CSP` 미설정)에서는 `script-src 'self' 'nonce-<...>' https://www.googletagmanager.com` 형태가 적용되어 인라인 스크립트는 nonce가 없으면 차단됩니다. Next.js가 FOUC 방지를 위해 인라인 `<style>`을 삽입하므로 `style-src 'self' 'unsafe-inline'`은 유지합니다.
- 개발/프리뷰 완화: `NODE_ENV !== 'production'`이거나 `NEXT_PUBLIC_RELAX_CSP=1`일 때는 HMR/DevTools용으로 `unsafe-inline`, `unsafe-eval`, `ws:` 등이 자동 허용됩니다. 테스트 목적으로 CSP를 임시 완화해야 한다면 프록시 대신 환경변수를 사용하세요.
- 리버스 프록시: Nginx 등 프록시는 `Content-Security-Policy` 헤더를 덮어쓰지 말고 그대로 전달해야 합니다. 운영 배포 시 프록시에 `proxy_hide_header Content-Security-Policy;` 같은 완화 설정이 남아있지 않은지 반드시 확인하십시오. 샘플 Nginx에는 CSP 예시/HSTS/XSS 헤더 주석이 포함되어 있습니다(`ops/nginx/nginx-site-web.conf`). 운영 vhost는 `ops/nginx/sogecon.conf`를 SSOT로 관리합니다.
- Google Analytics: `NEXT_PUBLIC_ANALYTICS_ID`가 설정되면 `https://www.googletagmanager.com` 스크립트와 `https://www.google-analytics.com` 전송 도메인이 자동 허용됩니다.

#### 운영 체크리스트
- [ ] `pnpm -C apps/web build` 후 `pnpm -C apps/web start` + reverse proxy 구성에서 브라우저 DevTools → Network 헤더로 CSP 적용 상태를 확인합니다.
- [ ] `style-src 'unsafe-inline'`을 그대로 둘 경우, 인라인 스타일 삽입이 필요한 컴포넌트만 사용하는지(Next 빌트인 스타일 태그) 정기적으로 점검하고 별도 인라인 스니펫을 추가하지 않도록 리뷰합니다.
- [ ] relax 모드(`NEXT_PUBLIC_RELAX_CSP=1`)는 개발/사내 환경에서만 사용하고, 운영에서는 제거했는지 배포 전 체크합니다.

### 전용 Postgres 컨테이너(선택)
- 다른 서비스와 충돌을 피하려면 전용 네트워크/DB 컨테이너를 사용할 수 있습니다.
  - 네트워크: `sogecon_net`
  - DB 컨테이너: `sogecon-db` (Postgres 16, 내부 네트워크 전용)
  - 예시 연결: `postgresql+psycopg://<user>:<pass>@sogecon-db:5432/<db>?sslmode=disable`
  - Alembic는 `ops/cloud-migrate.sh`를 DB 컨테이너와 동일 네트워크에서 실행하세요.
    ```bash
    DOCKER_NETWORK=sogecon_net ./ops/cloud-migrate.sh
    ```

### 롤백(요약)
- 직전 안정 태그로 이미지 pull → 재기동으로 복구합니다(대부분의 변경에서 DB downgrade 불필요).
  ```bash
  PREV=<stable-tag>
  docker pull ghcr.io/<owner>/<repo>/alumni-api:$PREV
  docker pull ghcr.io/<owner>/<repo>/alumni-web:$PREV
  API_IMAGE=ghcr.io/<owner>/<repo>/alumni-api:$PREV WEB_IMAGE=ghcr.io/<owner>/<repo>/alumni-web:$PREV \
    DOCKER_NETWORK=sogecon_net API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web ./ops/cloud-start.sh
  ```

### Nginx 502 완화 팁
- 재기동 직후 잠깐의 502는 정상일 수 있습니다. 필요 시 업스트림 타임아웃을 보수적으로 조정합니다.
  ```nginx
  proxy_connect_timeout 10s;
  proxy_read_timeout 30s;
  ```

### VPS 에이전트를 위한 바로가기
- VPS Agent Runbook (EN): `docs/agent_runbook_vps_en.md`
- VPS 에이전트 런북 (KR): `docs/agent_runbook_vps.md`
- SSOT(품질/운영 규칙): `docs/agents_base.md`, `docs/agents_base_kr.md` (규칙 변경은 SSOT 먼저 수정)
- 상세 배포 문서: `ops/deploy_api.md`, `ops/deploy_web.md`

---

## 개발 컨테이너 산출물(root 소유 방지)

개발용 Next 컨테이너(`web_dev`)가 바인드 마운트에 빌드 산출물을 쓰는 과정에서, 컨테이너가 root UID/GID로 동작하면 레포 안에 root 소유 파일이 생길 수 있습니다. 이 레포는 기본적으로 “컨테이너만 실행”해도, “호스트에서 실행”해도 root 소유물이 생기지 않도록 아래 방식을 사용합니다.

- 컨테이너 사용자 매핑: 루트 `compose.yaml`의 `web_dev` 서비스는 `user: "${UID:-1000}:${GID:-1000}"`로 설정되어 호스트 사용자와 동일 UID/GID로 동작합니다. `scripts/compose-dev-up.sh`가 `UID/GID`를 자동 전달합니다.
- pnpm/corepack 캐시: 컨테이너 내부 `HOME`을 `/tmp/devhome`으로 지정해 루트 홈 경로를 사용하지 않습니다.
- 1회 복구 스크립트(옵션): 과거에 root 소유물이 남아 있다면 아래 스크립트로 소유권을 되돌릴 수 있습니다(호스트 sudo 불필요).
  ```bash
  ./scripts/fix-web-perms.sh  # node_modules/.next/.pnpm-store 등을 현재 계정으로 chown
  ```

권장 실행 흐름(컨테이너 전용)
```bash
./scripts/compose-dev-up.sh web_dev   # dev 프로필로 web_dev 기동(UID/GID 전달)
open http://localhost:3000
```

호스트(dev)로 실행하고 싶을 때
```bash
corepack enable && pnpm -C apps/web install
pnpm -C apps/web dev
```

문제 해결: 포트/권한 에러가 발생하면
- 포트가 점유된 경우: `kill $(cat apps/web/.web-dev.pid) 2>/dev/null || true`
- 권한 에러(EACCES 등): `./scripts/fix-web-perms.sh` 실행 후 다시 기동
