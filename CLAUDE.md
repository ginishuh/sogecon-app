# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is governed by the English base `docs/agents_base.md` (Korean mirror: `docs/agents_base_kr.md`). In case of conflict, the base prevails.

## Architecture Overview

This is a monorepo for the 서강대학교 경제대학원 총동문회 (Sogang GS Economics Alumni) web application with the following structure:

- **`apps/web`**: Next.js frontend with App Router, Tailwind CSS, and PWA/Web Push support
- **`apps/api`**: FastAPI backend with SQLAlchemy, Alembic migrations, and PostgreSQL support
- **`packages/schemas`**: OpenAPI to TypeScript type generation utilities
- **`infra/`**: Docker Compose configuration for development PostgreSQL
- **`docs/`**: Development logs and documentation

The application supports both Korean and English documentation, with primary development happening in a Korean context.

자세한 설계 결정과 도메인 설명은 [`docs/architecture.md`](docs/architecture.md)에 최신화된다.

## Language and Communication (follow `docs/agents_base.md`)

- Primary language: Korean for internal docs and code comments
- Code comments: Korean by default; English identifiers; Korean domain terms allowed
- Documentation: Korean preferred for `docs/`
- Commits/PRs: Korean
- User-facing content: Korean by default

## Agents Base (verbatim copy)
This section mirrors the English base so this file is self‑contained for agents.

### Quality Guardrails (Non‑negotiable)
1) No Lint/Type Overrides (Default: Forbidden): no `eslint-disable`, `@ts-nocheck`, `@ts-ignore`, `# type: ignore`, `# pyright: ignore`, or file‑wide `# noqa` (except `apps/api/migrations/env.py: E402`).
2) Ban “unguardable” types and unsafe casts: forbid TS `any`/double-cast/non‑null spam; avoid Python `Any`‑heavy payloads.
3) Complexity & Spaghetti: complexity ≤10, depth ≤4, no import cycles.
4) Module size & structure: ≤600 lines; API Routers→Services→Repos; Web UI→hooks/services→API client.
5) Error handling: no bare except; no floating promises.
6) Notifications & Privacy: web push subs encrypted; drop dead subs (404/410).

### Testing & CI
- Pyright strict; Ruff complexity; ESLint rules.
- Python tools must run from `.venv` (use `make venv`, `make api-install`, `make test-api`).

### Commit & PR
- Conventional Commits `type(scope): subject` (72 chars). Types: `feat|fix|refactor|perf|test|chore|build|ci|docs`; scopes: `api|web|schemas|infra|docs|ops|ci|build`.
- Commitlint hook (pinned) must pass; CI re-checks.
- Non-doc changes update `docs/worklog.md`; pushes include `docs/dev_log_YYMMDD.md`.

### Language
- Korean default for docs/comments/commits/PRs; exceptions: vendor/generated/licences/protocol constants/external payloads. Add Korean note if English-only is required.

### Exceptions & Waivers
- Only `apps/api/migrations/env.py` may keep `# noqa: E402`. Waivers must include issue/owner/expiry and be local to code.

## Development Commands

### Database
- `make db-up` - Start PostgreSQL container (`docker compose -f infra/docker-compose.dev.yml up -d`)
- `make db-down` - Stop PostgreSQL container
- Database migrations: `alembic -c apps/api/alembic.ini upgrade head`

### API Development
- `make api-dev` - Start FastAPI dev server on port 3001 (`uvicorn apps.api.main:app --reload --port 3001`)
- Setup: `python -m venv .venv && source .venv/bin/activate && pip install -r apps/api/requirements.txt -r apps/api/requirements-dev.txt`

### Web Development
- `make web-dev` - Start Next.js dev server on port 3000 (`pnpm -C apps/web dev`)
- Setup: `corepack enable && pnpm -C apps/web install`
- Build: `pnpm -C apps/web build` (includes ESLint/TypeScript checks)
- Lint: `pnpm -C apps/web lint`

### Schema Generation
- `make schema-gen` - Generate TypeScript types from OpenAPI (`pnpm -C packages/schemas run gen`)

### Quality Assurance
- Python linting: `ruff check apps/api`
- Python type checking: `python -m pyright --project pyrightconfig.json`
- Python testing: `pytest -q` (requires activated .venv)
- Web type checking: `pnpm -C apps/web exec tsc --noEmit`

## Git Workflow and Hooks

Activate custom git hooks with: `git config core.hooksPath .githooks`

### Pre-commit Hook
- Runs `ruff check` on changed Python files
- Runs ESLint (flat config) on Web files
- Runs repo guards (see below) on staged files
- Requires `docs/worklog.md` update for code changes (documentation-only commits skip this)

### Pre-push Hook
- Checks for `docs/dev_log_YYMMDD.md` update for non-documentation changes
- Runs `pyright` for Python changes; runs tests if present
- Web builds run in CI, not in pre-push
- Runs schema generation for API changes when server is running

### CI Pipeline
- Skips Draft PRs, runs on Ready for Review
- Repo guards (ban overrides, max lines, etc.)
- Python: `ruff` → `pyright` → `compileall`
- Web: `pnpm build` (ESLint/TS checks)
- Security: `gitleaks` secret scanning

### Commit Messages
- Follow Conventional Commits (`type(scope): subject`). See `docs/commit_message_convention.md` and the base `docs/agents_base.md`.
- The `commit-msg` hook enforces commitlint (pinned). CI re-checks recent commits.

## Key Technologies

### Backend (apps/api)
- **FastAPI** 0.115.2 with **uvicorn** server
- **SQLAlchemy** 2.0.32 ORM with **PostgreSQL** (psycopg)
- **Alembic** for database migrations
- **Pydantic** for settings and validation
- **pytest** for testing

### Frontend (apps/web)
- **Next.js** with App Router
- **React** with TypeScript
- **Tailwind CSS** for styling
- **PWA/Web Push** support with service worker (see `docs/pwa_push.md`)

## Documentation Standards

- **Work logs**: Update `docs/worklog.md` for all code changes
- **Daily logs**: Create `docs/dev_log_YYMMDD.md` for development sessions
- **Task tracking**: Use `docs/todo.md` for project status

## Code Style

### Python
- Follow PEP8 with 4-space indentation
- Use `ruff` for linting and formatting
- Type hints enforced with `pyright`

### TypeScript/React
- 2-space indentation
- Functional components preferred
- ESLint with `next/core-web-vitals` config
- Prettier formatting

## Security Notes

- Never commit secrets or production credentials
- Use `.env` files (not committed) for local configuration
- Report security issues to `security@trr.co.kr` per SECURITY.md
- Default development uses SQLite, production uses PostgreSQL

## Testing Strategy

- API tests in `tests/api/test_<feature>.py` pattern
- Run with `pytest -q` in activated .venv
- CI validates with `ruff`, `pyright`, and `compileall`
- Web tests with `vitest` and/or `@testing-library/react` (add under `apps/web/__tests__/`)

## Quality Guardrails (see `docs/agents_base.md`)
- No lint/type overrides except the single Alembic exception.
- No unguardable types (`any`, `dict[str, Any]`, etc.); prefer generated DTOs and explicit models.
- Cyclomatic complexity ≤10; module size ≤600 lines; avoid import cycles.
