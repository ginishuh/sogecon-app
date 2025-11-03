# Repository Guidelines

> Important — Non‑SSOT
> - This file mirrors the base for convenience but is NOT an SSOT.
> - Canonical agent rules live in `docs/agents_base.md` (EN) and `docs/agents_base_kr.md` (KR).
> - 규칙 변경은 반드시 베이스 문서에서 먼저 수행합니다. 본 파일은 보조 미러입니다.
> - Update note (2025‑10‑08): Plan-only PRs are prohibited. If a PR contains a plan document, that PR must implement the full plan scope before Ready for Review/merge. See `docs/agents_base.md` → “Planning Docs in PRs”.

### Quick Links for Agents
- SSOT(EN): `docs/agents_base.md`
- SSOT(KR): `docs/agents_base_kr.md`
- VPS Runbook: `docs/agent_runbook_vps_en.md` (EN), `docs/agent_runbook_vps.md` (KR)

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
  - Enforcement: ESLint `@typescript-eslint/no-explicit-any:error`, `@typescript-eslint/ban-ts-comment` (only `@ts-expect-error` with description), and the `no-unsafe-*` rules. TSConfig must enable `strict`, `useUnknownInCatchVariables:true`, `noUncheckedIndexedAccess:true`.
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
  - Enforcement: Ruff `BLE001` (broad-except) and `E722` (bare except) are enabled in CI. Prefer `try/finally` for cleanup.
  - Narrow waivers only: one-line inline waiver with rule ID, rationale, linked issue, and removal date (e.g., `# noqa: BLE001 - reason; see #123, remove by 2025-11-01`). File/block-wide waivers are forbidden.
  - Boundary-only allowance: if a broad catch is absolutely necessary for fail-safe logging in boundaries (e.g., middleware loop), log then re-raise immediately and add the inline waiver.
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
 - PRs must use the repository PR template `.github/pull_request_template.md`. In Draft, fill only the top sections; before marking Ready for Review, complete all checklists in the template.

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

## Project Structure & Module Organization
- `apps/web`: Next.js App Router frontend with Tailwind configuration and PWA assets in `public/`.
- `apps/api`: FastAPI backend. `routers/` provides CRUD stubs, `models.py` and `schemas.py` define the domain, and `migrations/` stores the Alembic history.
- `packages/schemas`: Scripts that convert the API `openapi.json` into TypeScript DTOs.
- 루트 `compose.yaml`(profiles: dev): Development PostgreSQL 16 containers(dev/test)
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
 - Database: PostgreSQL only. Use root `compose.yaml` dev profile for local dev (port 5433/5434).
- Report security issues to `security@trr.co.kr` per `SECURITY.md` guidance.
 - See `docs/security_hardening.md` for security headers, SAST/Dependency audit, and CI policy.
