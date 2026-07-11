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
| `analyze` (CodeQL) | JS/TS + Python — PR + main + **매주 월요일 07:00 UTC** |

## main 브랜치 추가 검사

| Workflow | 트리거 | 목적 |
|----------|--------|--------|
| `dto-verify` | `push` main | 머지 후 OpenAPI/DTO 드리프트 방지 |
| `CodeQL` | push main, schedule (`0 7 * * 1`) | 심층 SAST (매주 월요일) |

## 보안 스캔 책임표

| 도구 | 범위 | PR | main | 주기 | 비고 |
|------|------|----|------|------|------|
| gitleaks | 비밀 | ✅ | — | — | 전체 히스토리 fetch |
| Semgrep | 정적 패턴 | ✅ | — | — | `p/ci` |
| Bandit | Python API | ✅ | — | — | pre-push에서도 Python 변경 시 |
| pip-audit | Python deps | ✅ | — | — | strict (`--strict`) |
| pnpm audit | Web prod deps | ✅ | — | — | `--audit-level=high` |
| CodeQL | JS/TS, Python | ✅ | ✅ | **매주 월요일 07:00 UTC** (`cron: 0 7 * * 1`) | GitHub Security 탭 |

중복을 줄이기 위해 **동일 검사를 로컬 훅과 CI에서 모두 전체 실행하지 않는다**. 예: pytest는 CI, pre-push는 Pyright+Bandit 중심.

## main 브랜치 보호 (수동 설정)

머지 후 GitHub **Settings → Rules → main** 에서 아래를 required status checks로 지정한다.

- `repo-guards` / `python` / `contract` / `web` / `secrets-scan` / `semgrep`
- (권장) CodeQL `analyze` matrix jobs
- (권장) `dto-verify` on main push

또는 `ops/ci/apply_main_branch_protection.sh`로 upsert한다(기존 `main-quality-gates` ruleset이 있으면 PUT, 없으면 POST).

```bash
bash ops/ci/apply_main_branch_protection.sh              # 기본: ginishuh/sogecon-app
bash ops/ci/apply_main_branch_protection.sh OWNER/REPO   # 다른 포크
```

Draft PR은 job이 skip되므로 Ready 전환 후 CI가 녹색인지 확인한다.

## 훅 통합 테스트

```bash
bash ops/ci/test_githooks.sh
# 또는
make test-hooks
```

PR CI `repo-guards` job에서도 동일 스크립트를 실행한다.

## 검증 기록 (#174, 2026-07-11)

로컬 측정(대표 환경, WSL2):

| 항목 | 측정 | 목표 | 비고 |
|------|------|------|------|
| pre-commit docs-only | ~50–200ms | ≤15s | 통합 테스트 내 자동 기록 |
| pre-commit python+spaces | ~1–3s | ≤15s | ruff 1파일 |
| commit-msg (pnpm+commitlint) | ~1–2s | ≤2s | |
| pre-push (py 변경, pyright+bandit) | ~15–45s | ≤90s | 변경 범위 의존 |

변경 전(2026-07-11 이전): CI commitlint `|| true`, Web lint/전체 test 미실행, 훅 도구 누락 시 skip.  
변경 후: hard gate + 명시적 Web lint/test + 훅 실패 고정.

CI 시간은 Draft→Ready 전환 후 Actions run URL로 PR에 기록한다.
