# Standardized Versions

쓰기 권위는 manifest다 (`apps/web/package.json`, 루트 `package.json`, `packages/schemas/package.json`, `apps/api/requirements*.txt`). 이 문서는 사람이 읽는 **검사된 projection**이며, `ops/ci/check_versions.py`가 exact pin을 `source/section/name` 키로 양방향 대조한다. 한쪽만 바꾸면 CI가 실패한다.

`<!-- pins: source/section -->` 다음의 `` `- name: x.y.z` `` / `` `- name==x.y.z` `` 줄만 핀이다. 서술·근거·제거 조건은 핀이 아니다.

## Runtime
- Python: 3.12.3 (CI 설정, Docker `python:3.12.3-slim`)
- Node.js: 24.12.0 (`apps/web/package.json#engines`, Docker `node:24.12.0-slim`)
- pnpm: 10.x (>=10.17.1 <11) (`apps/web/package.json#engines`, `.npmrc` engine-strict; CI는 범위 검사)
  - 참고: packageManager 고정은 사용하지 않고 engines 범위로만 관리합니다.
  - CI/빌드: `scripts/resolve_pnpm_version.sh`가 engines.pnpm 기준 메이저의 `latest-<major>` dist-tag를 사용합니다.

## Backend (apps/api)
<!-- pins: api/requirements -->
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
- cryptography==50.0.0
- Pillow==12.3.0
- sentry-sdk[starlette]==2.64.0
- apscheduler==3.11.3

### Dev tools
<!-- pins: api/requirements-dev -->
- ruff==0.15.21
- pyright==1.1.411
- pytest==9.1.1
- pytest-asyncio==1.4.0
- pytest-cov==7.1.0
- httpx==0.28.1
- bandit==1.9.4
- PyYAML==6.0.3 (`ops/ci/check_dependabot.py` 설정 검증)

## Frontend (apps/web)
<!-- pins: web/dependencies -->
- @tanstack/react-query: 5.101.2
- next: 16.2.11
- react: 19.2.7
- react-dom: 19.2.7
- web-vitals: 5.3.0

### Dev tools
<!-- pins: web/devDependencies -->
- @eslint/eslintrc: 3.3.6
- @next/bundle-analyzer: 16.2.11
- @tailwindcss/postcss: 4.3.2
- @testing-library/jest-dom: 6.9.1
- @testing-library/react: 16.3.2
- @types/node: 24.13.3
- @types/react: 19.2.17
- @types/react-dom: 19.2.3
- @typescript-eslint/eslint-plugin: 8.63.0
- @typescript-eslint/parser: 8.63.0
- @vitest/coverage-v8: 4.1.10
- axe-core: 4.12.1
- baseline-browser-mapping: 2.10.42
- eslint: 9.39.5
- eslint-config-next: 15.5.20
  - Next 16 native flat config와 ESLint 10 전환은 #186에서 함께 처리합니다. 현재는 기존 ESLint 9 품질 게이트를 유지합니다.
- eslint-import-resolver-typescript: 3.10.1
- eslint-plugin-import: 2.32.0
- eslint-plugin-promise: 7.3.0
- eslint-plugin-react-hooks: 5.2.0
- jsdom: 29.1.1
- postcss: 8.5.26
- puppeteer: 24.43.1
- tailwindcss: 4.3.2
- typescript: 5.9.3
- vitest: 4.1.10

## 워크스페이스
<!-- pins: root/devDependencies -->
- @commitlint/cli: 20.1.0
- png-to-ico: 3.0.2
- sharp: 0.35.3
- vite: 8.1.4
  - #183에서 Vitest 3용 임시 보안 override를 제거하고 workspace devDependency로 직접 고정합니다.

## 스키마
<!-- pins: schemas/devDependencies -->
- openapi-typescript: 7.13.0

## pnpm overrides
<!-- pins: root/pnpm.overrides -->
- js-yaml: 4.2.0
  - 근거: commitlint·ESLint 계열의 전이 범위가 GHSA-h67p-54hq-rp68에 취약한 4.1.1도 선택하므로 수정 버전으로 강제합니다.
  - 제거 조건: 모든 상위 패키지가 js-yaml 4.2.0 이상만 선택하는 범위로 갱신되면 제거합니다.
- nanoid: 3.3.18
  - 근거: PostCSS 8.5.26이 `nanoid ^3.3.17`을 고르고, pnpm audit는 GHSA-2v37-7h3g-55p8의 패치를 `>=3.3.18`로 봅니다.
  - 제거 조건: 상위 패키지가 nanoid 3.3.18 이상만 선택하는 범위로 갱신되면 제거합니다.
- postcss: 8.5.26
  - 근거: Next.js 16.2.x가 PostCSS 8.4.31을 직접 고정하므로 GHSA-qx2v-qp2m-jg93·GHSA-fxqj-rqcc-2cmp 수정 버전으로 강제합니다.
  - 제거 조건: Next.js가 postcss 8.5.23 이상만 선택하는 범위로 갱신되면 제거합니다.
- sharp: 0.35.3
  - 근거: Next.js 선택 의존성이 취약한 Sharp 0.34.x를 다시 고르지 않도록 2026-07-28 보안 패치에서 workspace override를 0.35.3으로 고정했습니다.
  - 제거 조건: Next.js가 Sharp 0.35.3 이상만 선택하는 범위로 갱신되면 제거합니다.

그 밖의 전이 의존성과 `^` 범위(`@phosphor-icons/react`)·`workspace:*`는 lockfile로 관리합니다. 임시 override가 다시 필요하면 취약점 또는 호환성 근거, 영향받는 상위 패키지, 제거 조건을 이 문서와 PR에 기록해야 합니다.

변경 시에는 manifest와 이 문서를 동시 업데이트하고, PR에서 `ops/ci/check_versions.py`가 통과하는지 확인하세요. FastAPI가 Starlette 버전을 관리하므로 Starlette는 별도 핀 고정하지 않습니다.
