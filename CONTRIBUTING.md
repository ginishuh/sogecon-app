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
- `git config core.hooksPath .githooks`로 커스텀 훅을 활성화하세요.
- 사전 설치: `pnpm install`(루트, `@commitlint/cli`) · `make venv && make api-install`(ruff, pyright, bandit) · `pnpm -C apps/web install`
- 필수 도구가 없으면 훅이 **실패**합니다(skip 없음). 재현 명령은 `docs/ci_quality_gates.md` 참고.
- 프리커밋: 스테이징된 Python/Web 파일만 `ruff`/`eslint`. 문서 전용 커밋은 통과.
- 커밋 메시지: `pnpm exec commitlint` + `Log:` 줄(코드 변경 시). `[skip-commitlog]`는 문서 전용만.
- 프리푸시: `docs/dev_log_YYMMDD.md` 필수(비문서). Python 변경 시 `pyright`+`bandit`. 계약 변경 시 OpenAPI/DTO 드리프트 검증. **자동 pip install 없음** — requirements 변경 후 venv를 직접 갱신.
- CI는 PR에서 API/Web 전체 lint·test·build·계약 검증을 수행합니다.
