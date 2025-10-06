## Copilot instructions for this repo

> Important — Non‑SSOT
> - This guide is NOT the SSOT for agent rules.
> - Canonical: `docs/agents_base.md` (English), `docs/agents_base_kr.md` (Korean).
> - 본 문서는 보조 안내이며 SSOT가 아닙니다. 규칙 변경은 베이스에서 먼저 진행하세요.

Context: Monorepo for Sogang GS Economics Alumni app. This guide includes the English base content inline so it is self‑contained for agents. Frontend: Next.js App Router (TypeScript, Tailwind, PWA/Web Push). Backend: FastAPI + SQLAlchemy + Alembic. Local DB defaults to SQLite; Postgres via docker-compose for dev. See [`docs/architecture.md`](../docs/architecture.md) for the consolidated technical design (Korean).

Language and Communication (base, verbatim)
- Primary language: Korean for internal docs and code comments.
- Code comments: Korean by default; English identifiers; Korean domain terms allowed.
- Documentation: Korean preferred for `docs/` folder.
- Commit messages and PR descriptions: Korean.
- User-facing content: Korean by default.

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
- TS: Always handle promise rejections (`no-floating-promises`).

### 6) Notifications & Privacy (Web Push)
- Treat push subscriptions as sensitive data; store endpoints/keys encrypted at rest and redact in logs. Invalidate 404/410 subscriptions.

## Testing & CI Expectations
- Pyright runs in strict mode; Ruff enforces complexity; ESLint enforces TS rules above.
- Python tools (ruff, pyright, pytest) MUST run from the project `.venv`. Make targets (`make venv`, `make api-install`, `make test-api`) are provided.

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

Architecture and data flow
- apps/api: FastAPI app (`apps/api/main.py`) exposes routers: `members`, `posts`, `events`, `rsvps`. CORS is configured from `config.get_settings()`.
- apps/web: Next.js App Router uses client components under `apps/web/app/**` to fetch from the API. Base URL is `process.env.NEXT_PUBLIC_WEB_API_BASE` (fallback `http://localhost:3001`). See `posts/page.tsx`, `events/page.tsx`.
- packages/schemas: Generates TypeScript DTOs from OpenAPI (run via `make schema-gen`).

Backend conventions (FastAPI/SQLAlchemy/Pydantic)
- Settings come from environment with aliases: `DATABASE_URL`, `APP_ENV`, `JWT_SECRET`, `CORS_ORIGINS` (`apps/api/config.py`). Default DB is `sqlite:///./dev.sqlite3`.
- DB session is provided via `Depends(get_db)` from `apps/api/db.py` (sessionmaker with `future=True`).
- SQLAlchemy models live in `apps/api/models.py`. Pydantic schemas in `apps/api/schemas.py`. Always convert ORM to Pydantic with `ModelRead.model_validate(orm_obj)` in routers (see `members.list_members`).
- Enums: use `models.RSVPStatus(payload.status)` when setting enum fields (see `events.create_rsvp`).
- Pagination pattern: cursor-based where possible (`?after=<cursor>&limit=<n>`). Keep offsets only for admin pages.
- Health check: `GET /healthz`.

Frontend conventions (Next.js)
- App Router with simple pages: `app/page.tsx`, `app/posts/page.tsx`, `app/events/page.tsx`. Prefer server components/data fetching; on client use `useEffect` + `fetch(`${API_BASE}/resource?limit=20`)` and show loading/error/empty states.
- Tailwind is configured; global styles in `app/globals.css`. Experimental typed routes enabled in `next.config.js`.
- PWA/Web Push: `app/sw-register.tsx` registers `/sw.js` from `public/`. Follow `docs/pwa_push.md` for subscription/notification flow.

Developer workflows (local)
- DB: `make db-up` to start Postgres via `infra/docker-compose.dev.yml` (optional; SQLite works by default). `make db-down` to stop.
- API: create venv, install `apps/api/requirements*.txt`, run `make api-dev` (uvicorn on 3001). Apply migrations: `alembic -c apps/api/alembic.ini upgrade head`.
- Web: `corepack enable && pnpm -C apps/web install`, then `make web-dev` (Next.js on 3000).
- Schemas: `make schema-gen` to regenerate TS types from OpenAPI (requires API reachable).

Quality gates & CI
- Hooks: enable with `git config core.hooksPath .githooks`. Pre-commit runs ruff/ESLint and repo guards on changed files. Pre-push ensures `docs/dev_log_YYMMDD.md` is updated and runs `pyright`; builds run in CI.
- CI (Ready for Review PRs): Repo guards → Python `ruff → pyright → compileall` → Web `pnpm build` → Security `gitleaks`.

Quality guardrails (enforced): no suppression comments (`eslint-disable`, `@ts-nocheck`, `@ts-ignore`, `# type: ignore`, `# noqa`, etc., except Alembic `env.py E402`), cyclomatic complexity ≤10, module size ≤600 lines, import cycles denied. Full policy: `docs/agents_base.md`.

Commit & PR: Follow Conventional Commits. The `commit-msg` hook runs commitlint; CI re-validates recent commits. See `docs/commit_message_convention.md`. PRs must use `.github/pull_request_template.md`; in Draft, fill the top sections; before Ready for Review, complete all checklists.

When extending
- New API endpoint: update SQLAlchemy models (if needed), add Pydantic schema(s), create router in `apps/api/routers/`, wire it in `apps/api/main.py`, and add Alembic migration under `apps/api/migrations/versions/`. Return Pydantic models with `model_validate`.
- New web page: create `apps/web/app/<route>/page.tsx` mirroring `posts/events` fetch pattern and read `NEXT_PUBLIC_WEB_API_BASE`.
- Keep logs up to date: add a one-line entry to `docs/worklog.md` and update/create `docs/dev_log_YYMMDD.md` for non-doc changes.
