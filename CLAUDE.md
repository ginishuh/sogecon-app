# CLAUDE.md

> Important — Non‑SSOT
> - This document is NOT a Single Source of Truth.
> - Canonical agent rules: `docs/agents_base.md` (EN), `docs/agents_base_kr.md` (KR).
> - Update (2025‑10‑08): Plan‑only PRs are prohibited; PRs with plan docs must implement the full plan before Ready for Review/merge. See `docs/agents_base.md` → “Planning Docs in PRs”.
> - 본 문서는 SSOT가 아닙니다. 규칙 변경은 베이스 문서에서 먼저 수행하세요.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is governed by the English base `docs/agents_base.md` (Korean mirror: `docs/agents_base_kr.md`). In case of conflict, the base prevails.

Quick links for server rollouts:
- VPS Agent Runbook: `docs/agent_runbook_vps_en.md` (EN), `docs/agent_runbook_vps.md` (KR)
- Deploy docs: `ops/deploy_api.md`, `ops/deploy_web.md`

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
This section mirrors the English base `docs/agents_base.md` verbatim so this file is self‑contained for agents.

# Agents Base (English)

This is the canonical, English “Agents Base” for this repository. All agent-facing docs (AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, etc.) MUST align with this base. If there is any conflict, this document prevails. Keep the Korean companion in `docs/agents_base_kr.md` in sync.

## Scope & Sync
- Source of truth for agent/editor guidelines and code-quality guardrails.
- Other agent docs should link to this file and avoid duplicating details. Minor doc drift is allowed only for examples; rules must be identical.

## SSOT
- This is not a product/system SSOT; it governs agent/editor guidelines only.
- Repository SSOT docs (authoritative for their domains):
  - `docs/Project_overview.md` — product vision, IA, north star scope and roadmap.
  - `docs/architecture.md` — system architecture, domain decisions, API surfaces.
  - `docs/pwa_push.md` — PWA/Web Push design and operational flows.
  - `docs/versions.md` — pinned runtimes/toolchain versions (CI‑enforced).
  - `docs/security_hardening.md` — security guardrails and CI/SAST policy.
  - `SECURITY.md` — vulnerability reporting and security contact.
- If guidance here conflicts with a domain SSOT, the domain SSOT prevails for that scope; this guide still governs code‑quality and agent behavior.

## Quality Guardrails (Non‑negotiable)

### 1) No Lint/Type Overrides (Default: Forbidden)
Do NOT disable linters or type checkers globally or per file.
- Forbidden examples: `/* eslint-disable */`, `// eslint-disable-next-line`, `// @ts-nocheck`, `// @ts-ignore`, `# type: ignore`, `# pyright: ignore`, `# noqa` (file-level or broad).
- Only exception: Alembic `apps/api/migrations/env.py` may use `# noqa: E402` due to tool constraints.
- If absolutely necessary elsewhere, a one-line localized suppression may be used only with ALL of the following:
  1) Specific rule ID (e.g., `@ts-expect-error` with description, `noqa: F401`),
  2) Inline rationale (what/why),
  3) Linked issue or TODO with clear removal plan/date.

### 2) Ban “unguardable” types and unsafe casts
- TypeScript: `any`, double-casts (`as unknown as T`), pervasive non-null assertions (`!`) are forbidden. Prefer `unknown` + explicit narrowing, discriminated unions, and generated DTO types.
  - Enforcement: ESLint `@typescript-eslint/no-explicit-any:error`, `@typescript-eslint/ban-ts-comment` (allow only `@ts-expect-error` with description), and `no-unsafe-*` rules. TSConfig must enable `strict`, `useUnknownInCatchVariables:true`, `noUncheckedIndexedAccess:true`.
- Python: Avoid `Any`, `dict[str, Any]`, `list[Any]`, and broad `object` for domain data. Use Pydantic models, TypedDict, or explicit generics.

### 3) Complexity & Spaghetti-code guards
- Maximum cyclomatic complexity: 10 per function (Python via Ruff mccabe C901; TS via ESLint `complexity`).
- Maximum nesting depth: 4 (TS via ESLint `max-depth`).
- Prohibit import cycles (TS via `import/no-cycle`).

### 4) Module Size & Structure
- Maximum 600 lines per source file (excluding generated migrations). Split modules early.
- Enforce clear layering:
  - API: Routers → Services → Repositories/DB. Routers must not touch ORM directly.
  - Web: UI components → hooks/services → API client. Components must not hardcode fetch logic when shared clients exist.

### 5) Error handling and logging
- Python: No bare `except:` or `except Exception:`—catch specific exceptions. Never silently ignore errors.
  - Enforcement: Ruff `BLE001` and `E722` in CI; prefer `try/finally` for cleanup.
  - Inline one-line waivers only, with rule ID + rationale + issue link + removal date.
  - Boundary allowance: log then rethrow immediately if absolutely required.
- TS: Always handle promise rejections (`no-floating-promises`).

### 6) Notifications & Privacy (Web Push)
- Treat push subscriptions as sensitive data; store endpoints/keys encrypted at rest and redact in logs. Invalidate 404/410 subscriptions.

## Testing & CI Expectations
- Pyright runs in strict mode; Ruff enforces complexity; ESLint enforces TS rules above.
- Python tools (ruff, pyright, pytest) MUST run from the project `.venv`. Make targets (`make venv`, `make api-install`, `make test-api`) are provided.

### Local Run Modes (Dev vs Mirror)
- Dev profile (local only): use the root `compose.yaml` with `docker compose --profile dev up -d` for hot reload (Next.js dev + uvicorn --reload). Never run the dev profile on servers; the helper script `scripts/compose-dev-up.sh` includes a production guard.
- Mirror mode (prod parity): to validate deploy behavior locally, run the same scripts used on VPS: pull immutable images → Alembic migrate → restart via `ops/cloud-*.sh` or `scripts/deploy-vps.sh`. Use a dedicated Docker network (e.g., `sogecon_net`) and container DNS (e.g., `sogecon-db`) in `DATABASE_URL`.
- Switching modes: stop current containers before switching; dev→mirror: `docker compose --profile dev down`; mirror→dev: `docker rm -f alumni-api alumni-web` then start dev profile.

## Commit & PR Conventions
- Follow Conventional Commits for all commits: `type(scope): subject` with a 72-char header.
- Allowed types: `feat|fix|refactor|perf|test|chore|build|ci|docs`; scopes: `api|web|schemas|infra|docs|ops|ci|build`.
- Use imperative, present-tense subjects; Korean is fine. Details: `docs/commit_message_convention.md`.
- The `commit-msg` hook runs `@commitlint/cli` (pinned) via pnpm dlx and must pass locally; CI re-validates recent commits.
- Non-doc changes must update `docs/worklog.md`; pushes must include the current `docs/dev_log_YYMMDD.md` entry.

## Language & Communication
- Primary language: Korean for all internal documentation and code comments across this repository.
- Code comments: write comments in Korean by default. Use English for identifiers (variables, functions, types); Korean domain terms are acceptable when they improve clarity.
- User-facing copy: Korean by default unless a feature explicitly requires another language.
- Commits/PRs: write commit messages and PR descriptions in Korean.
- Exceptions (may remain in English): vendored/third‑party code, auto‑generated files, license texts, protocol constants, quotes from external systems, and external API payloads/fixtures.
- When introducing English-only content for technical reasons, include a brief Korean note or summary in the same change whenever practical.
- Repo guards fail CI on:
  - Disallowed suppression comments (see 1),
  - Files over 600 lines,
  - Other policy violations declared here.

## Exceptions & Waivers
- Only the migration bootstrap `apps/api/migrations/env.py` may keep `# noqa: E402`.
- Temporary waivers must include: linked issue, owner, expiry date. Waivers live next to code, not global configs.

## Edit Policy
- Propose changes in a PR that updates BOTH `agents_base.md` and `agents_base_kr.md`, then reference the change in AGENTS.md/CLAUDE.md.

## Development Commands

### Database
- `make db-up` - Start PostgreSQL containers (dev+test) via root compose dev profile
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
 - PRs must use `.github/pull_request_template.md`. For Draft, fill the top sections; before Ready for Review, complete all checklists.

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
- Database: PostgreSQL only (local dev via docker-compose)

## Testing Strategy

- API tests in `tests/api/test_<feature>.py` pattern
- Run with `pytest -q` in activated .venv
- CI validates with `ruff`, `pyright`, and `compileall`
- Web tests with `vitest` and/or `@testing-library/react` (add under `apps/web/__tests__/`)

## Quality Guardrails (see `docs/agents_base.md`)
- No lint/type overrides except the single Alembic exception.
- No unguardable types (`any`, `dict[str, Any]`, etc.); prefer generated DTOs and explicit models.
- Cyclomatic complexity ≤10; module size ≤600 lines; avoid import cycles.
