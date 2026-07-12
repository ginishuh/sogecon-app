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
- uvicorn[standard]==0.51.0
- sqlalchemy==2.0.51
- psycopg[binary]==3.3.4
- alembic==1.18.5
- pydantic-settings==2.14.2
- python-multipart==0.0.32
- slowapi==0.1.10
- bcrypt==5.0.0
- itsdangerous==2.2.0
- email-validator==2.3.0
- pywebpush==2.3.0
- cryptography==49.0.0
- Pillow==12.3.0
- sentry-sdk[starlette]==2.64.0
- apscheduler==3.11.3

### Dev tools
- ruff==0.15.21
- pyright==1.1.411
- pytest==9.1.1
- pytest-asyncio==1.4.0
- httpx==0.28.1
- bandit==1.9.4
- PyYAML==6.0.3 (`ops/ci/check_dependabot.py` 설정 검증)

## Frontend (apps/web)
- next: 16.2.10
- react: 19.2.7
- react-dom: 19.2.7
- web-vitals: 5.3.0
- @tanstack/react-query: 5.101.2

### Dev tools
- typescript: 5.9.3
- eslint: 9.39.5
- eslint-config-next: 15.5.20
  - Next 16 native flat config와 ESLint 10 전환은 #186에서 함께 처리합니다. 현재는 기존 ESLint 9 품질 게이트를 유지합니다.
- @next/bundle-analyzer: 16.2.10
- @eslint/eslintrc: 3.3.6
- @typescript-eslint/eslint-plugin: 8.63.0
- @typescript-eslint/parser: 8.63.0
- eslint-plugin-import: 2.32.0
- eslint-import-resolver-typescript: 3.10.1
- eslint-plugin-promise: 7.3.0
- tailwindcss: 4.3.2
- @tailwindcss/postcss: 4.3.2
- postcss: 8.5.16
- @testing-library/jest-dom: 6.9.1
- @testing-library/react: 16.3.2
- @types/node: 24.13.3
- @types/react: 19.2.17
- axe-core: 4.12.1
- baseline-browser-mapping: 2.10.42
- puppeteer: 24.43.1
- vitest: 4.1.10
- jsdom: 29.1.1

## 워크스페이스 및 스키마
- openapi-typescript: 7.13.0
- sharp: 0.35.3
- png-to-ico: 3.0.2
- vite: 8.1.4
  - #183에서 Vitest 3용 임시 보안 override를 제거하고 workspace devDependency로 직접 고정합니다.
- pnpm overrides:
  - js-yaml: 4.2.0
    - 근거: commitlint·ESLint 계열의 전이 범위가 GHSA-h67p-54hq-rp68에 취약한 4.1.1도 선택하므로 수정 버전으로 강제합니다.
    - 제거 조건: 모든 상위 패키지가 js-yaml 4.2.0 이상만 선택하는 범위로 갱신되면 제거합니다.
  - postcss: 8.5.16
    - 근거: Next.js 16.2.10이 PostCSS 8.4.31을 직접 고정하므로 GHSA-qx2v-qp2m-jg93의 수정 버전으로 강제합니다.
    - 제거 조건: Next.js가 postcss 8.5.10 이상만 선택하는 범위로 갱신되면 제거합니다.

그 밖의 전이 의존성은 상위 패키지의 호환 범위와 lockfile로 관리합니다. 임시 override가 다시 필요하면 취약점 또는 호환성 근거, 영향받는 상위 패키지, 제거 조건을 이 문서와 PR에 기록해야 합니다.

 변경 시에는 본 문서와 실제 파일(`apps/api/requirements*.txt`, `apps/web/package.json`, `package.json`, `packages/schemas/package.json`)을 동시 업데이트하고, PR에서 `ops/ci/check_versions.py`가 통과하는지 확인하세요. FastAPI가 Starlette 버전을 관리하므로 Starlette는 별도 핀 고정하지 않습니다.
