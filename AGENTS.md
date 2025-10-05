# Repository Guidelines

## Agents Base (verbatim copy)
This section mirrors the English base `docs/agents_base.md` so that this document is self‑contained for all agents.

### Scope & Sync
- Source of truth for agent/editor guidelines and code-quality guardrails.
- Other agent docs should align with this content. Rules must be identical.

### Quality Guardrails (Non‑negotiable)
1) No Lint/Type Overrides (Default: Forbidden)
- Do NOT disable linters or type checkers globally or per file.
- Forbidden examples: `/* eslint-disable */`, `// eslint-disable-next-line`, `// @ts-nocheck`, `// @ts-ignore`, `# type: ignore`, `# pyright: ignore`, `# noqa` (file-level or broad).
- Only exception: Alembic `apps/api/migrations/env.py` may use `# noqa: E402` due to tool constraints.
- If absolutely necessary elsewhere, a one-line localized suppression may be used only with ALL of: specific rule ID, inline rationale, linked issue/removal plan.

2) Ban “unguardable” types and unsafe casts
- TS: forbid `any`, double-casts (`as unknown as T`), pervasive `!`. Prefer `unknown`+narrowing, discriminated unions, generated DTOs.
- Python: avoid `Any`, `dict[str, Any]`, `list[Any]`, broad `object`. Prefer Pydantic models/TypedDict/explicit generics.

3) Complexity & Spaghetti-code guards
- Max cyclomatic complexity 10; max nesting depth 4; forbid import cycles.

4) Module Size & Structure
- Max 600 lines per source file (generated migrations excluded). Split modules early.
- Layering: API Routers → Services → Repositories/DB; Web UI → hooks/services → API client.

5) Error handling and logging
- Python: no bare `except:`/`except Exception:`; TS: handle promise rejections.

6) Notifications & Privacy (Web Push)
- Treat push subscriptions as sensitive; encrypt at rest; redact in logs; drop 404/410.

### Testing & CI Expectations
- Pyright strict; Ruff enforces complexity; ESLint enforces TS rules.
- Python tools must run from project `.venv` (use `make venv`, `make api-install`, `make test-api`).

### Commit & PR Conventions
- Conventional Commits `type(scope): subject` (72 chars). Types: `feat|fix|refactor|perf|test|chore|build|ci|docs`. Scopes: `api|web|schemas|infra|docs|ops|ci|build`.
- Imperative present-tense; Korean allowed/preferred. See `docs/commit_message_convention.md`.
- `commit-msg` hook (pinned commitlint) must pass; CI re-validates.
- Non-doc changes must update `docs/worklog.md`; pushes must include `docs/dev_log_YYMMDD.md`.

### Language & Communication
- Primary: Korean for internal docs and code comments.
- Code comments: Korean by default; English identifiers; Korean domain terms allowed.
- User-facing copy: Korean by default.
- Commits/PRs: Korean.
- Exceptions: vendored/third‑party, generated, licenses, protocol constants, external quotes and API payloads/fixtures.
- If English-only content is necessary, add a brief Korean note when practical.

### Exceptions & Waivers
- Only `apps/api/migrations/env.py` may keep `# noqa: E402`.
- Temporary waivers require linked issue/owner/expiry and live next to code.

### Edit Policy
- Update BOTH `agents_base.md` and `agents_base_kr.md` when changing rules; keep this copy in sync.

> This document is governed by the English base: `docs/agents_base.md` (and mirrored in Korean: `docs/agents_base_kr.md`). In case of any conflict, the English base prevails. Do not diverge from the base; keep sections in sync.

## Project Structure & Module Organization
- `apps/web`: Next.js App Router frontend with Tailwind configuration and PWA assets in `public/`.
- `apps/api`: FastAPI backend. `routers/` provides CRUD stubs, `models.py` and `schemas.py` define the domain, and `migrations/` stores the Alembic history.
- `packages/schemas`: Scripts that convert the API `openapi.json` into TypeScript DTOs.
- `infra/docker-compose.dev.yml`: Development PostgreSQL 16 container.
- `ops/`: Placeholder for cloud automation scripts.
- `docs/`: Track notes in `todo.md`, `worklog.md`, and date-based `dev_log_YYMMDD.md` files. Core technical design decisions live in [`docs/architecture.md`](docs/architecture.md) (Korean).

## Build, Test, and Development Commands
- `make db-up` / `make db-down`: Start or stop the PostgreSQL container.
- `make venv` → `make api-install`: Create `.venv` and install API deps.
- `make api-dev`: Run API using `.venv`’s uvicorn on port 3001.
- `make web-dev`: Launch the Next.js development server (`http://localhost:3000`).
- `make schema-gen`: Generate TypeScript types from OpenAPI (`packages/schemas`).
 - `make test-api`: Run API tests in `.venv` (`pytest -q`).
- CI pipeline verifies quality with `ruff`, `pyright`, `python -m compileall`, and `pnpm -C apps/web build`.

## Language and Communication
- Primary language: Korean. Follow the base language rules in `docs/agents_base.md` (code comments, docs, commits/PRs in Korean by default; exceptions as listed there).
- Code comments: Document business logic or domain-specific behavior in Korean when clarification is needed.
- Documentation: Prefer Korean for updates under `docs/`, mirroring the guidance in `CLAUDE.md`.
- Commit messages and PRs: Write summaries and descriptions in Korean.
- Variable and identifier names: Use standard English naming unless a Korean domain term improves clarity.
- User-facing strings: Provide Korean copy by default.

## Coding Style & Naming Conventions
- Python: Follow PEP8 with 4-space indentation. After activating `.venv`, install tooling with `pip install -r apps/api/requirements.txt -r apps/api/requirements-dev.txt` to get `ruff` and `pyright`.
- TypeScript/React: Use 2-space indentation and prefer functional components. Keep ESLint (`next/core-web-vitals`) and Prettier active.
- Logs: Maintain cumulative notes in `docs/worklog.md` and daily notes in `docs/dev_log_YYMMDD.md`.
- Module names (routers, hooks, etc.): Use lowercase with hyphens/underscores (e.g., `members.py`, `cloud-start.sh`).

### Quality Guardrails (summary; see `docs/agents_base.md`)
- Do not use suppression comments: `eslint-disable`, `@ts-nocheck`, `@ts-ignore`, `# type: ignore`, `# pyright: ignore`, `# noqa` (file-wide). The only standing exception is `apps/api/migrations/env.py` with `# noqa: E402`.
- Avoid unguardable types and unsafe casts: TS `any`/double-cast/non-null spam; Python `Any`-heavy payloads.
- Complexity ≤ 10; nesting ≤ 4; prevent import cycles; keep modules ≤ 600 lines (split early).

## Testing Guidelines
- Activate `.venv` and run `pytest -q` for API tests; follow the `tests/api/test_<feature>.py` pattern.
- CI continues to enforce `ruff`, `pyright`, and `compileall` for static checks.
- Web testing: Introduce `vitest` or `@testing-library/react` under `apps/web/__tests__/`.
- Database migrations: Validate with `alembic -c apps/api/alembic.ini upgrade head`.

## Documentation & Logs Policy
- Add a one-line summary to `docs/worklog.md` for every code change commit.
- For non-documentation changes, update the relevant `docs/dev_log_YYMMDD.md` entry before pushing.
- Documentation-only changes bypass hooks; update `docs/todo.md` when status shifts.

## Commit & Pull Request Guidelines
- Enable hooks via `git config core.hooksPath .githooks`.
- Pre-commit hook: Runs `ruff` on changed Python files and `eslint`/`tsc --noEmit` on changed web files (documentation-only commits skip this).
- Pre-push hook: Requires a `docs/dev_log_YYMMDD.md` update for non-documentation changes, runs `pyright` (from the active venv or `.venv`) for Python updates, runs `pytest -q` when tests exist, and `pnpm -C packages/schemas run gen` for schema updates when the server is running. Web build runs in CI, not pre-push.
- Pull requests: Use imperative, present-tense commit messages, provide a detailed description, include related issues/screenshots. Draft PRs pause CI; full checks run once marked Ready for Review.
 - Commit messages must follow Conventional Commits. See `docs/commit_message_convention.md`. The commit-msg hook enforces this with commitlint (pinned via pnpm dlx).

## Security & Configuration Tips
- Do not commit `.env`; keep the example file updated instead.
- Default database is SQLite (`sqlite:///./dev.sqlite3`); PostgreSQL follows `infra/docker-compose.dev.yml`.
- Report security issues to `security@trr.co.kr` per `SECURITY.md` guidance.
 - See `docs/security_hardening.md` for security headers, SAST/Dependency audit, and CI policy.
