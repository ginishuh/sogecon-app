# Contributing

Thanks for supporting the 서강대학교 경제대학원 총동문회 app. Contributions are welcome.

## Recommended Environment
- WSL2 on Windows or a native Unix-like environment.

## Quickstart

### DB
```
docker compose --profile dev up -d postgres postgres_test
```

### API
```
python -m venv .venv && source .venv/bin/activate
pip install -r apps/api/requirements.txt -r apps/api/requirements-dev.txt
alembic -c apps/api/alembic.ini upgrade head
uvicorn apps.api.main:app --reload --port 3001
```

### Web
```
corepack enable
pnpm -C apps/web i && pnpm -C apps/web dev
```

## Code Style
- Python: black or ruff (optional but encouraged).
- Web: prettier and eslint.

## Safety
- Do not commit secrets or production credentials to the repository.

## Testing
- `.venv` 활성화 후 `pytest -q`로 API 테스트를 실행할 수 있습니다. 현재는 스켈레톤 상태이므로 smoke 테스트 추가를 권장합니다.

## Git Hooks
- `git config core.hooksPath .githooks`로 커스텀 훅을 활성화하세요. `.venv`를 활성화한 뒤 `pip install -r apps/api/requirements.txt -r apps/api/requirements-dev.txt`로 도구(ruff, pyright)를 설치해야 합니다.
- 프리커밋: 변경된 Python 파일에만 `ruff check`를, 변경된 Web 파일에만 `eslint`/`tsc --noEmit`를 실행합니다. 문서 전용 커밋은 자동으로 통과합니다.
- 커밋 메시지: Conventional Commits를 따릅니다. `docs/commit_message_convention.md`를 참고하세요. `commit-msg` 훅이 `commitlint`(pnpm dlx, 고정 버전)와 커밋로그(`Log: ...`) 형식을 함께 검사합니다. `[skip-commitlog]`는 문서 전용 커밋에서만 허용됩니다.
- 프리푸시: 비-문서 변경 푸시에는 당일 `docs/dev_log_YYMMDD.md`가 필수입니다. Python 변경이 있으면 활성 venv 기준 `pyright`를 실행합니다. 테스트는 CI에서 수행합니다. Schemas 변경 시 `pnpm -C packages/schemas run gen`을 수행합니다.
- CI는 `ruff`, `pyright`, `python -m compileall`, `pnpm -C apps/web build`를 실행하므로 로컬 훅과 중복 검사를 최소화했습니다.
