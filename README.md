# 서강대학교 경제대학원 총동문회 앱 (Segecon App)

공개 웹 애플리케이션 모노레포입니다. 브랜드는 **서강대학교 경제대학원 총동문회**입니다.

![Static Badge](https://img.shields.io/badge/Python-3.12.3-3776AB?logo=python&logoColor=white)
![Static Badge](https://img.shields.io/badge/Node-22.17.1-339933?logo=node.js&logoColor=white)
![Static Badge](https://img.shields.io/badge/pnpm-10.17.1-F69220?logo=pnpm&logoColor=white)
![Static Badge](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Static Badge](https://img.shields.io/badge/FastAPI-0.118-009688?logo=fastapi)
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
- 환경 변수 가이드
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
infra/     # docker-compose.dev.yml (Postgres 16)
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

1) 데이터베이스(선택: Postgres 컨테이너 또는 SQLite)
```bash
make db-up  # docker compose -f infra/docker-compose.dev.yml up -d
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

## 환경 변수 가이드(발췌)
- `DATABASE_URL`: 기본은 개발용 Postgres(`postgresql+psycopg://...:5433/...`), SQLite 사용 시 `sqlite:///./dev.sqlite3`.
- `NEXT_PUBLIC_WEB_API_BASE`: 웹이 호출하는 API 베이스(기본 `http://localhost:3001`).
- `CORS_ORIGINS`: 개발 기본 `http://localhost:3000`.
- Web Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- 도커 포트: `DB_DEV_PORT=5433`, `DB_TEST_PORT=5434` (포트 충돌 시 변경).
- 샘플과 전체 목록은 `.env.example` 참고.

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
- 코드 내 시크릿 금지. `.env`만 사용하고 예제는 `.env.example` 갱신 유지.

## 자주 묻는 질문(트러블슈팅)
- 포트 충돌(5433/5434): `.env`의 `DB_DEV_PORT/DB_TEST_PORT` 변경 후 `make db-down && make db-up`.
- `uvicorn`/`pytest` 못 찾음: 가상환경이 없거나 다른 venv 사용 중입니다. `make venv && make api-install` 후 재시도.
- `pnpm` 명령 없음: `corepack enable` 실행 후 터미널 재시작 또는 `pnpm -v`로 확인.
- API/Web 백그라운드 실행/중지: `make dev-up` / `make dev-down`(로그는 `logs/` 참조).

## 라이선스
MIT © 2025 Traum — 자세한 내용은 `LICENSE` 참조.

---
문서 기본 언어는 한국어입니다. 사용자 노출 텍스트/README 역시 한국어를 우선합니다. 필요한 경우 간단한 영어 요약을 함께 제공합니다.
