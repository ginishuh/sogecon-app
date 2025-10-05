# 서강대학교 경제대학원 총동문회 앱

**EN Summary**
- Public monorepo for the Sogang GS Economics Alumni web service
- Contains Next.js frontend, FastAPI backend, and schema tooling
- Local-first setup with Dockerized Postgres, custom Git hooks, and CI via GitHub Actions
- See below for full Korean documentation; English quickstart steps are mirrored in comments

---

서강대학교 경제대학원 총동문회 공개 웹 애플리케이션을 위한 모노레포입니다. 브랜드는 **"서강대학교 경제대학원 총동문회"**, 참고용 사이트는 https://sogangeconomics.com 입니다.

## 주요 특징
- **모노레포 구조**: Next.js 프런트(`apps/web`), FastAPI 백엔드(`apps/api`), 스키마 생성 툴(`packages/schemas`)을 한 곳에서 관리합니다.
- **로컬 친화적 환경**: WSL2 및 macOS/리눅스에서 바로 실행 가능하며, 개발용 Postgres 컨테이너를 포함합니다.
- **모바일 웹 우선 · PWA/Web Push**: Tailwind 기반 UI와 PWA 아티팩트, 설치형 웹앱, Web Push 알림을 지원합니다. 세부는 `docs/pwa_push.md` 참고.
- **품질 자동화**: Git 훅과 GitHub Actions가 `ruff`, `pyright`, `pytest`, `pnpm build`, `gitleaks`를 통해 기본 품질을 보장합니다.

## 폴더 구조
```
apps/            # web(Next.js), api(FastAPI)
packages/schemas # OpenAPI → TypeScript 타입 생성 스크립트
infra/           # docker-compose.dev.yml (Postgres 16)
ops/             # 클라우드 훅 플레이스홀더
docs/            # todo/worklog/dev_log_YYMMDD 기록
```

## 빠른 시작
1. **데이터베이스**
   ```bash
   docker compose -f infra/docker-compose.dev.yml up -d
   ```
2. **API 서버(venv 필수)**
    ```bash
   # 활성 venv가 있다면 그대로 사용됩니다. 없다면 .venv를 생성하세요.
   make venv && make api-install
   # 현재 감지된 venv 확인
   make info-venv
    alembic -c apps/api/alembic.ini upgrade head
    make api-dev  # uvicorn apps.api.main:app --reload --port 3001
    ```
3. **웹 앱**
   ```bash
   corepack enable
   pnpm -C apps/web install
   make web-dev  # Next.js dev server (http://localhost:3000)
   ```
4. **스키마 타입 생성 (선택)**
   ```bash
   pnpm -C packages/schemas install
   make schema-gen
   ```

> **English Quickstart (mirror)**
> 1. `docker compose -f infra/docker-compose.dev.yml up -d`
> 2. `make venv && make api-install`
>    `alembic -c apps/api/alembic.ini upgrade head`
>    `make api-dev`
> 3. `corepack enable`
>    `pnpm -C apps/web install`
>    `make web-dev`
> 4. `pnpm -C packages/schemas install` (optional)
>    `make schema-gen`

## 품질 및 워크플로
- `git config core.hooksPath .githooks`로 훅을 활성화하면, 프리커밋은 변경된 파일만 대상으로 `ruff`와 `eslint/tsc`를 실행합니다.
- 프리푸시는 `docs/dev_log_YYMMDD.md` 업데이트 여부를 확인하고, Python 변경 시 `pyright`, Web 변경 시 `pnpm build`를 실행합니다. API가 실행 중일 때만 스키마 생성을 시도합니다.
- CI는 Draft PR에는 대기하고, Ready for Review 이후 `ruff` → `pyright` → `compileall` → `pnpm build` → `gitleaks` 순으로 실행됩니다.

## 문서와 커뮤니케이션
- 작업 로그는 `docs/worklog.md`, 일일 기록은 `docs/dev_log_YYMMDD.md`에 남겨 주세요.
- 보안 이슈는 `SECURITY.md` 지침에 따라 `security@trr.co.kr`로 우선 보고합니다.
- 기여 가이드는 `CONTRIBUTING.md`, 저장소 운영 원칙은 `AGENTS.md`에서 확인할 수 있습니다.

행복한 동문 서비스를 위해 기여해 주세요! 🙌
