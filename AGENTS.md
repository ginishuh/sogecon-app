# Repository Guidelines

## Project Structure & Module Organization
- `apps/web`: Next.js App Router frontend with Tailwind configuration and PWA assets in `public/`.
- `apps/api`: FastAPI backend. `routers/` provides CRUD stubs, `models.py` and `schemas.py` define the domain, and `migrations/` stores the Alembic history.
- `packages/schemas`: Scripts that convert the API `openapi.json` into TypeScript DTOs.
- `infra/docker-compose.dev.yml`: Development PostgreSQL 16 container.
- `ops/`: Placeholder for cloud automation scripts.
- `docs/`: Track notes in `todo.md`, `worklog.md`, and date-based `dev_log_YYMMDD.md` files.

## Build, Test, and Development Commands
- `make db-up` / `make db-down`: Start or stop the PostgreSQL container.
- `make api-dev`: Run `uvicorn apps.api.main:app --reload --port 3001`.
- `make web-dev`: Launch the Next.js development server (`http://localhost:3000`).
- `make schema-gen`: Generate TypeScript types from OpenAPI (`packages/schemas`).
- CI pipeline verifies quality with `ruff`, `pyright`, `python -m compileall`, and `pnpm -C apps/web build`.

## Language and Communication
- Primary language: Korean. Default to answering in Korean unless the user explicitly chooses another language.
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
- Pre-push hook: Requires a `docs/dev_log_YYMMDD.md` update for non-documentation changes, runs `pyright` for Python updates, `pnpm -C apps/web build` for web updates, and `pnpm -C packages/schemas run gen` for schema updates when the server is running.
- Pull requests: Use imperative, present-tense commit messages, provide a detailed description, include related issues/screenshots. Draft PRs pause CI; full checks run once marked Ready for Review.

## Security & Configuration Tips
- Do not commit `.env`; keep the example file updated instead.
- Default database is SQLite (`sqlite:///./dev.sqlite3`); PostgreSQL follows `infra/docker-compose.dev.yml`.
- Report security issues to `security@trr.co.kr` per `SECURITY.md` guidance.
