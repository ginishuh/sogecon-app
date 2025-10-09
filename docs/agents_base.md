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
  - Enforcement: ESLint `@typescript-eslint/no-explicit-any:error`, `@typescript-eslint/ban-ts-comment` (allow only `@ts-expect-error` with description), and the `no-unsafe-*` rule set. TSConfig must enable `strict`, `useUnknownInCatchVariables:true`, `noUncheckedIndexedAccess:true`.
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
- Python: No bare `except:` or `except Exception:` — catch specific exceptions. Never silently ignore errors.
  - Enforcement: Ruff `BLE001` (broad-except) and `E722` (bare except) are enabled in CI. Use precise exceptions or `try/finally` for cleanup.
  - Narrow waivers: only allow a one-line inline waiver with explicit rule ID and rationale, plus a linked issue and removal date (e.g., `# noqa: BLE001 - reason; see #123, remove by 2025-11-01`). File‑ or block‑level waivers are forbidden.
  - Boundary-only allowance: in process boundaries (e.g., ASGI middleware loop), prefer `try/finally`. If a broad catch is unavoidable for fail-safe logging, immediately re-raise after logging and add the inline waiver as above.
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
 - PRs must use the repository PR template `.github/pull_request_template.md`. In Draft, fill only the top sections; before marking Ready for Review, complete all checklists in the template.

### Planning Docs in PRs
- Plan-only PRs are prohibited. Do not open a PR that only adds a plan document.
- If a PR includes a plan document (e.g., `docs/plan_YYMMDD.md`, `docs/mN_plan.md`, `docs/execution_plan_*.md`), that PR must implement the entire plan scope within the same PR before it is marked Ready for Review or merged. Draft is allowed during implementation, but merging without the code is not.
- PR titles/descriptions must reflect the implementation scope (not just “add plan”).

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

## Dev Environment & Envs (2025‑10‑06)
- API runs locally with uvicorn; PostgreSQL runs via Docker Compose.
  - Start/stop DBs: `make db-up` / `make db-down`.
  - Default ports: dev `5433`, test `5434`. Override via `infra/.env`:
    - `DB_DEV_PORT` (default `5433`), `DB_TEST_PORT` (default `5434`).
  - Ensure `.env` `DATABASE_URL` uses the selected dev port.
- CORS config: `CORS_ORIGINS` must be a JSON array string (e.g., `["http://localhost:3000"]`).
- Web Push choice: Standard Web Push (VAPID) — FCM not used at this stage.
  - `.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
  - `apps/web/.env.local`: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
  - Never commit secrets; keep `*.example` files updated.
- Privacy & ops for Web Push
  - Server logs store only SHA‑256 hash + last 16 chars of endpoints.
  - Subscriptions returning 404/410 are auto‑invalidated.
  - Admin test: `POST /admin/notifications/test` payload `{ title, body, url? }`.
  - Admin UI: `/admin/notifications` shows test form, recent logs, and summary.
