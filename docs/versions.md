# Standardized Versions

본 문서는 로컬(WSL2 전역 도구 제외)에서 레포가 직접 관리하는 의존성/도구의 고정 버전을 정의합니다. CI는 `ops/ci/check_versions.py`로 이를 강제합니다.

## Runtime
- Python: 3.12.3 (CI 설정)
- Node.js: 24.12.0 (`apps/web/package.json#engines`)
- pnpm: 10.x (>=10.17.1 <11) (`apps/web/package.json#engines`, `.npmrc` engine-strict; CI는 범위 검사)
  - 참고: packageManager 고정은 사용하지 않고 engines 범위로만 관리합니다.
  - CI/빌드: `scripts/resolve_pnpm_version.sh`가 engines.pnpm 기준 메이저의 `latest-<major>` dist-tag를 사용합니다.

## Backend (apps/api)
- fastapi==0.139.0
- uvicorn[standard]==0.37.0
- sqlalchemy==2.0.43
- psycopg[binary]==3.2.10
- alembic==1.16.5
- pydantic-settings==2.11.0
- python-multipart==0.0.32
- slowapi==0.1.9
- cryptography==49.0.0
- Pillow==12.3.0

### Dev tools
- ruff==0.13.2
- pyright==1.1.404
- pytest==9.1.1
- pytest-asyncio==1.4.0

## Frontend (apps/web)
- next: 15.5.20
- react: 19.2.7
- react-dom: 19.2.7
- @tanstack/react-query: 5.101.2

### Dev tools
- typescript: 5.9.3
- eslint: 9.39.5
- eslint-config-next: 15.5.20
- @eslint/eslintrc: 3.3.6
- @typescript-eslint/eslint-plugin: 8.63.0
- @typescript-eslint/parser: 8.63.0
- eslint-plugin-import: 2.32.0
- eslint-import-resolver-typescript: 3.10.1
- eslint-plugin-promise: 7.3.0
- tailwindcss: 3.4.19
- autoprefixer: 10.5.2
- postcss: 8.5.16
- @testing-library/jest-dom: 6.9.1
- @testing-library/react: 16.3.2
- axe-core: 4.12.1
- puppeteer: 24.43.1

 변경 시에는 본 문서와 실제 파일(`apps/api/requirements*.txt`, `apps/web/package.json`)을 동시 업데이트하고, PR에서 `ops/ci/check_versions.py`가 통과하는지 확인하세요. FastAPI가 Starlette 버전을 관리하므로 Starlette는 별도 핀 고정하지 않습니다.
