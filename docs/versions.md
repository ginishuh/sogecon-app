# Standardized Versions

본 문서는 로컬(WSL2 전역 도구 제외)에서 레포가 직접 관리하는 의존성/도구의 고정 버전을 정의합니다. CI는 `ops/ci/check_versions.py`로 이를 강제합니다.

## Runtime
- Python: 3.12.3 (CI 설정)
- Node.js: 22.21.1 (`apps/web/package.json#engines`)
- pnpm: 10.17.1 (`apps/web/package.json#packageManager`, `.npmrc` engine-strict; CI는 Corepack으로 pin)

## Backend (apps/api)
- fastapi==0.123.5
- uvicorn[standard]==0.37.0
- sqlalchemy==2.0.43
- psycopg[binary]==3.2.10
- alembic==1.16.5
- pydantic-settings==2.11.0
- python-multipart==0.0.20
- slowapi==0.1.9

### Dev tools
- ruff==0.13.2
- pyright==1.1.404
- pytest==8.4.2

## Frontend (apps/web)
- next: 15.5.4
- react: 19.1.1
- react-dom: 19.1.1

### Dev tools
- typescript: 5.8.3
- eslint: 9.36.0
- eslint-config-next: 15.5.2
- @typescript-eslint/eslint-plugin: 8.44.1
- @typescript-eslint/parser: 8.44.1
- eslint-plugin-import: 2.32.0
- eslint-import-resolver-typescript: 3.10.1
- eslint-plugin-promise: 7.2.1
- tailwindcss: 3.4.13
- autoprefixer: 10.4.21
- postcss: 8.5.6

 변경 시에는 본 문서와 실제 파일(`apps/api/requirements*.txt`, `apps/web/package.json`)을 동시 업데이트하고, PR에서 `ops/ci/check_versions.py`가 통과하는지 확인하세요. FastAPI가 Starlette 버전을 관리하므로 Starlette는 별도 핀 고정하지 않습니다.
