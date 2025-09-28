# Repository Guidelines

## Project Structure & Module Organization
- `apps/web`: Next.js App Router 프런트엔드, Tailwind 설정과 PWA 자산(`public/`) 포함.
- `apps/api`: FastAPI 백엔드. `routers/`는 CRUD 스텁, `models.py`·`schemas.py`는 도메인 정의, `migrations/`는 Alembic 히스토리.
- `packages/schemas`: API `openapi.json`을 TypeScript DTO로 변환하는 스크립트 패키지.
- `infra/docker-compose.dev.yml`: 개발용 Postgres 16 컨테이너.
- `ops/`: 클라우드 자동화 스크립트 플레이스홀더.
- `docs/`: `todo.md`, `worklog.md`, 날짜별 `dev_log_YYMMDD.md`로 작업 메모를 추적.

## Build, Test, and Development Commands
- `make db-up` / `make db-down`: Postgres 컨테이너 기동/종료.
- `make api-dev`: `uvicorn apps.api.main:app --reload --port 3001` 실행.
- `make web-dev`: Next.js 개발 서버(`http://localhost:3000`).
- `make schema-gen`: OpenAPI → TS 타입 생성(`packages/schemas`).
- CI 파이프라인은 `ruff`, `pyright`, `python -m compileall`, `pnpm -C apps/web build`로 품질을 검증합니다.

## Coding Style & Naming Conventions
- Python: PEP8, 4칸 인덴트. `.venv` 활성화 후 `pip install -r apps/api/requirements.txt -r apps/api/requirements-dev.txt`로 `ruff`/`pyright` 설치.
- TypeScript/React: 2칸 인덴트, 함수형 컴포넌트 우선. ESLint(`next/core-web-vitals`)와 Prettier 유지.
- 로그 파일은 `docs/worklog.md`(누적), `docs/dev_log_YYMMDD.md`(날짜별) 형식을 지킵니다.
- 라우터·훅 등 모듈 이름은 소문자-하이픈/언더스코어 패턴을 따릅니다(`members.py`, `cloud-start.sh`).

## Testing Guidelines
- `.venv`를 활성화한 뒤 `pytest -q`로 API 테스트를 실행할 수 있으며, 테스트 파일은 `tests/api/test_<feature>.py` 패턴을 권장합니다.
- CI는 여전히 `ruff`·`pyright`·`compileall`을 통해 정적 품질을 확인합니다.
- Web 테스트는 `vitest` 또는 `@testing-library/react`를 도입해 `apps/web/__tests__/`에 배치합니다.
- 데이터 마이그레이션은 `alembic -c apps/api/alembic.ini upgrade head`로 검증합니다.

## Documentation & Logs Policy
- 코드 변경 커밋은 `docs/worklog.md`에 한 줄 요약을 추가해야 합니다.
- 비-문서 변경을 푸시할 때는 해당 날짜의 `docs/dev_log_YYMMDD.md` 업데이트를 포함하세요.
- 문서 전용 변경은 훅에서 자동 통과하며 필요한 경우 `docs/todo.md` 상태를 갱신합니다.

## Commit & Pull Request Guidelines
- `git config core.hooksPath .githooks`로 훅을 활성화합니다.
- 프리커밋 훅: 변경된 Python 파일에 `ruff`, 변경된 Web 파일에 `eslint`/`tsc --noEmit`만 실행(문서 전용 패스).
- 프리푸시 훅: 비-문서 변경 시 `docs/dev_log_YYMMDD.md` 확인 후 Python 변경에 `pyright`, Web 변경에 `pnpm -C apps/web build`, Schemas 변경에 `pnpm -C packages/schemas run gen`.
- PR은 명령형 현재형 커밋 메시지, 상세 설명, 관련 이슈/스크린샷 포함. Draft 상태에서는 CI가 대기하며, Ready for Review 전환 시 전체 검사가 실행됩니다.

## Security & Configuration Tips
- `.env`는 커밋하지 말고 예시 파일을 갱신합니다.
- 기본 DB는 SQLite(`sqlite:///./dev.sqlite3`), Postgres는 `infra/docker-compose.dev.yml` 설정을 따릅니다.
- 보안 이슈는 `SECURITY.md` 지침에 따라 `security@trr.co.kr`로 우선 보고하세요.
