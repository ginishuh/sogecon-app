# CI 품질 게이트

로컬 Git 훅과 GitHub Actions PR CI의 책임 분리·재현 명령을 정리한다. 상위 Epic: #174.

## 설계 원칙

| 계층 | 목표 시간 | 역할 |
|------|-----------|------|
| `commit-msg` | 1~2초 | Conventional Commits + 커밋로그(`Log:`) |
| `pre-commit` | 5~15초 | 스테이징된 파일만 — repo guard, Ruff, ESLint |
| `pre-push` | 30~90초 | push 범위 — Pyright, Bandit, OpenAPI/DTO(계약 변경 시) |
| PR CI | 수 분 | 전체 회귀 — API/Web lint·test·build·계약·보안 |
| main/주기 | — | 머지 후 DTO 검증, CodeQL 스케줄 |

도구가 없으면 **조용히 skip하지 않고 실패**한다. 설치 안내는 각 훅 메시지와 아래 절을 따른다.

## 로컬 재현 명령

```bash
# 1회 설정
git config core.hooksPath .githooks
make venv && make api-install
pnpm install
pnpm -C apps/web install

# PR CI와 동일한 검증(요약)
python ops/ci/guards.py
python ops/ci/check_versions.py
pnpm exec commitlint --from origin/main --to HEAD --config docs/commitlint.config.cjs
ruff check apps/api
.venv/bin/python -m pyright --project pyrightconfig.json
pytest -q
pnpm -C apps/web lint
pnpm -C apps/web test
pnpm -C apps/web build
python scripts/export_openapi.py && pnpm -C packages/schemas run gen-dts
git diff --exit-code packages/schemas/openapi.json packages/schemas/index.d.ts
```

## PR CI 필수 job (Ready for Review)

| Job | 내용 |
|-----|------|
| `repo-guards` | guards, versions, **commitlint (hard)** |
| `python` | ruff, pyright, pytest, bandit, pip-audit |
| `contract` | OpenAPI export + DTO drift |
| `web` | **eslint**, **vitest 전체**, build, a11y smoke, bundle, pnpm audit |
| `secrets-scan` | gitleaks |
| `semgrep` | Semgrep `p/ci` |
| `e2e` (별도 workflow) | Puppeteer E2E — 현재 `continue-on-error` (#143) |
| `analyze` (CodeQL) | JS/TS + Python — PR + main + weekly |

## main 브랜치 추가 검사

| Workflow | 트리거 | 목적 |
|----------|--------|--------|
| `dto-verify` | `push` main | 머지 후 OpenAPI/DTO 드리프트 방지 |
| `CodeQL` | push main, schedule | 심층 SAST |

## 보안 스캔 책임표

| 도구 | 범위 | PR | main | 주기 | 비고 |
|------|------|----|------|------|------|
| gitleaks | 비밀 | ✅ | — | — | 전체 히스토리 fetch |
| Semgrep | 정적 패턴 | ✅ | — | — | `p/ci` |
| Bandit | Python API | ✅ | — | — | pre-push에서도 Python 변경 시 |
| pip-audit | Python deps | ✅ | — | — | strict; Starlette waiver 추적 |
| pnpm audit | Web prod deps | ✅ | — | — | `--audit-level=high` |
| CodeQL | JS/TS, Python | ✅ | ✅ | 월 1회 | GitHub Security 탭 |

중복을 줄이기 위해 **동일 검사를 로컬 훅과 CI에서 모두 전체 실행하지 않는다**. 예: pytest는 CI, pre-push는 Pyright+Bandit 중심.

## main 브랜치 보호 (수동 설정)

머지 후 GitHub **Settings → Rules → main** 에서 아래를 required status checks로 지정한다.

- `repo-guards` / `python` / `contract` / `web` / `secrets-scan` / `semgrep`
- (권장) CodeQL `analyze` matrix jobs
- (권장) `dto-verify` on main push

Draft PR은 job이 skip되므로 Ready 전환 후 CI가 녹색인지 확인한다.

## 훅 스모크 테스트

```bash
bash ops/ci/test_githooks.sh
```
