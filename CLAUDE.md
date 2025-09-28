# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a monorepo for the 서강대학교 경제대학원 총동문회 (Sogang GS Economics Alumni) web application with the following structure:

- **`apps/web`**: Next.js frontend with App Router, Tailwind CSS, and PWA support
- **`apps/api`**: FastAPI backend with SQLAlchemy, Alembic migrations, and PostgreSQL support
- **`packages/schemas`**: OpenAPI to TypeScript type generation utilities
- **`infra/`**: Docker Compose configuration for development PostgreSQL
- **`docs/`**: Development logs and documentation

The application supports both Korean and English documentation, with primary development happening in a Korean context.

## Language and Communication

- **Primary Language**: Korean is the primary language for this project
- **Code Comments**: Write code comments in Korean when explaining business logic or domain-specific concepts
- **Documentation**: Korean is preferred for internal documentation in `docs/` folder
- **Commit Messages**: Use Korean for commit messages and PR descriptions
- **Variable Names**: Use English for variable/function names following standard conventions, but Korean is acceptable for domain-specific terms
- **User-Facing Content**: All user-facing content should be in Korean

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
- Build: `pnpm -C apps/web build`
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
- Runs `eslint` and `tsc --noEmit` on changed Web files
- Requires `docs/worklog.md` update for code changes (documentation-only commits skip this)

### Pre-push Hook
- Checks for `docs/dev_log_YYMMDD.md` update for non-documentation changes
- Runs `pyright` for Python changes
- Runs `pnpm -C apps/web build` for Web changes
- Runs schema generation for API changes when server is running

### CI Pipeline
- Skips Draft PRs, runs on Ready for Review
- Python: `ruff` → `pyright` → `compileall`
- Web: `pnpm build`
- Security: `gitleaks` secret scanning

## Key Technologies

### Backend (apps/api)
- **FastAPI** 0.115.2 with **uvicorn** server
- **SQLAlchemy** 2.0.32 ORM with **PostgreSQL** (psycopg)
- **Alembic** for database migrations
- **Pydantic** for settings and validation
- **pytest** for testing

### Frontend (apps/web)
- **Next.js** 14.2.5 with App Router
- **React** 18.3.1 with TypeScript 5.5.4
- **Tailwind CSS** 3.4.8 for styling
- **PWA** support with service worker

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
- Web testing framework not yet established (consider vitest or @testing-library/react)