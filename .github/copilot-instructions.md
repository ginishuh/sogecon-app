## Copilot instructions for this repo

Context: Monorepo for Sogang GS Economics Alumni app. Frontend: Next.js App Router (TypeScript, Tailwind, PWA). Backend: FastAPI + SQLAlchemy + Alembic. Local DB defaults to SQLite; Postgres via docker-compose for dev. See [`docs/architecture.md`](../docs/architecture.md) for the consolidated technical design (Korean).

Language and Communication
- Primary language: Korean. Default to answering in Korean unless the user explicitly chooses another language.
- Code comments: Write in Korean when explaining business logic or domain-specific concepts.
- Documentation: Korean preferred for internal docs in `docs/` folder.
- Commit messages and PR descriptions: Use Korean.
- Variable/function names: Use English following standard conventions, but Korean is acceptable for domain-specific terms.
- User-facing content: Provide in Korean by default.

Architecture and data flow
- apps/api: FastAPI app (`apps/api/main.py`) exposes routers: `members`, `posts`, `events`, `rsvps`. CORS is configured from `config.get_settings()`.
- apps/web: Next.js App Router uses client components under `apps/web/app/**` to fetch from the API. Base URL is `process.env.NEXT_PUBLIC_WEB_API_BASE` (fallback `http://localhost:3001`). See `posts/page.tsx`, `events/page.tsx`.
- packages/schemas: Generates TypeScript DTOs from OpenAPI (run via `make schema-gen`).

Backend conventions (FastAPI/SQLAlchemy/Pydantic)
- Settings come from environment with aliases: `DATABASE_URL`, `APP_ENV`, `JWT_SECRET`, `CORS_ORIGINS` (`apps/api/config.py`). Default DB is `sqlite:///./dev.sqlite3`.
- DB session is provided via `Depends(get_db)` from `apps/api/db.py` (sessionmaker with `future=True`).
- SQLAlchemy models live in `apps/api/models.py`. Pydantic schemas in `apps/api/schemas.py`. Always convert ORM to Pydantic with `ModelRead.model_validate(orm_obj)` in routers (see `members.list_members`).
- Enums: use `models.RSVPStatus(payload.status)` when setting enum fields (see `events.create_rsvp`).
- Pagination pattern: `limit` (1–100) and `offset` query params with validation (`fastapi.Query`). Ordering examples: posts by `published_at desc`, events by `starts_at asc`.
- Health check: `GET /healthz`.

Frontend conventions (Next.js)
- App Router with simple pages: `app/page.tsx`, `app/posts/page.tsx`, `app/events/page.tsx`. Fetch on client with `useEffect` + `fetch(`${API_BASE}/resource?limit=20`)` and show loading/error/empty states.
- Tailwind is configured; global styles in `app/globals.css`. Experimental typed routes enabled in `next.config.js`.
- PWA: lightweight service worker registration in `app/sw-register.tsx` registering `/sw.js` from `public/`.

Developer workflows (local)
- DB: `make db-up` to start Postgres via `infra/docker-compose.dev.yml` (optional; SQLite works by default). `make db-down` to stop.
- API: create venv, install `apps/api/requirements*.txt`, run `make api-dev` (uvicorn on 3001). Apply migrations: `alembic -c apps/api/alembic.ini upgrade head`.
- Web: `corepack enable && pnpm -C apps/web install`, then `make web-dev` (Next.js on 3000).
- Schemas: `make schema-gen` to regenerate TS types from OpenAPI (requires API reachable).

Quality gates & CI
- Hooks: enable with `git config core.hooksPath .githooks`. Pre-commit runs ruff/eslint/tsc on changed files. Pre-push ensures `docs/dev_log_YYMMDD.md` is updated and runs `pyright` and `pnpm -C apps/web build` as needed.
- CI (Ready for Review PRs): Python `ruff → pyright → compileall`; Web `pnpm build`; Security `gitleaks`.

When extending
- New API endpoint: update SQLAlchemy models (if needed), add Pydantic schema(s), create router in `apps/api/routers/`, wire it in `apps/api/main.py`, and add Alembic migration under `apps/api/migrations/versions/`. Return Pydantic models with `model_validate`.
- New web page: create `apps/web/app/<route>/page.tsx` mirroring `posts/events` fetch pattern and read `NEXT_PUBLIC_WEB_API_BASE`.
- Keep logs up to date: add a one-line entry to `docs/worklog.md` and update/create `docs/dev_log_YYMMDD.md` for non-doc changes.
