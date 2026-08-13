# Contributing

Thanks for supporting the 서강대학교 경제대학원 총동문회 app. Contributions are welcome.

## Recommended Environment
- WSL2 on Windows or a native Unix-like environment.

## Quickstart

### DB
```
make db-up
```

### API
```
make venv && make api-install
make api-migrate
make api-dev
```

`api-dev` starts the API process. It does not run migrations.

### Web
```
pnpm -C apps/web install
pnpm -C apps/web dev
```

## Code Style
- Python: Ruff is required.
- Web: ESLint is required.
- Required local and PR gates: `docs/ci_quality_gates.md`.

## Safety
- Do not commit secrets or production credentials to the repository.

## Testing
- API: `make test-api` (required).
- Architecture, E2E, versions, and commit format: use the task table in `AGENTS.md`.

## Git Hooks
- Enable custom hooks with `git config core.hooksPath .githooks`.
- Install once: root `pnpm install` (commitlint), `make venv && make api-install` (ruff, pyright, bandit), and `pnpm -C apps/web install`.
- Missing required tools fail the hook (no skip). Reproduction commands: `docs/ci_quality_gates.md`.
- Pre-commit: staged Python/Web files only (`ruff`/`eslint`). Docs-only commits pass.
- Commit message: `pnpm exec commitlint` plus a `Log:` line for code changes. `[skip-commitlog]` is docs-only.
- Pre-push: same-day `docs/dev_log_YYMMDD.md` for non-docs pushes. Python changes run `pyright` and `bandit`. Contract changes verify OpenAPI/DTO drift. Hooks do not auto-run `pip install` — refresh the venv after requirements changes.
- CI runs full API/Web lint, test, build, and contract checks on the PR.
