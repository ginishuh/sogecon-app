# CI 품질 게이트

로컬 Git 훅과 GitHub Actions PR CI의 책임 분리·재현 명령을 정리한다. 상위 Epic: #174.

## D6 Web build와 container command negative gates

- `pnpm -C apps/web build`는 `apps/web/next.config.js`의 production phase에서
  `NEXT_PUBLIC_WEB_API_BASE`를 검증한다. missing/blank, malformed 또는 relative,
  HTTP는 실패하며, `WEB_BUILD_ALLOW_INSECURE_LOCAL_API=1`이어도 loopback HTTP만
  허용한다. 일반 Web CI build는 deterministic `https://api.example.com`을 사용한다.
- 의도적인 local production E2E/Lighthouse build만 다음처럼 escape hatch를 함께
  지정한다. `next dev`에는 이 값이 필요 없다.

```bash
NEXT_PUBLIC_WEB_API_BASE=http://127.0.0.1:3001 \
WEB_BUILD_ALLOW_INSECURE_LOCAL_API=1 pnpm -C apps/web build
```

- 다음 명령은 실제 `docker run` 인자, image/env/network preflight, API→Web health
  순서, missing/unhealthy health 실패, bounded redacted logs를 검증한다.

```bash
bash ops/ci/test_cloud_start.sh
```

`repo-guards` job은 `test_cloud_migrate.sh`와 함께 이 command contract를 실행한다.

## 설계 원칙

| 계층 | 목표 시간 | 역할 |
|------|-----------|------|
| `commit-msg` | 1~2초 | Conventional Commits + 커밋로그(`Log:`) |
| `pre-commit` | 5~15초 | 스테이징된 파일만 — repo guard, Ruff, ESLint |
| `pre-push` | 30~90초 | push 범위 — Pyright, Bandit, OpenAPI/DTO(계약 변경 시) |
| PR CI | 수 분 | 전체 회귀 — API/Web lint·test·build·계약·보안 |
| main/주기 | — | 머지 후 DTO 검증, CodeQL 스케줄 |

도구가 없으면 **조용히 skip하지 않고 실패**한다. 설치 안내는 각 훅 메시지와 아래 절을 따른다. 에이전트 하네스는 `AGENTS.md` 단일 실행 SSOT와 12줄 이내 클라이언트 어댑터 구조를 `ops/ci/guards.py`가 검증한다.

## 로컬 재현 명령

```bash
# 1회 설정
git config core.hooksPath .githooks
make venv && make api-install
pnpm install
pnpm -C apps/web install

# PR CI와 동일한 검증(요약)
.venv/bin/python ops/ci/guards.py
.venv/bin/python ops/ci/check_versions.py
pnpm exec commitlint --from origin/main --to HEAD --config docs/commitlint.config.cjs
# D5 전용 disposable PostgreSQL만 사용한다. appdb/appdb_test/운영 DB는 금지.
# 기존 DB가 있으면 먼저 정확한 이름만 drop하고 같은 이름으로 create한다.
D5_DATABASE_URL=postgresql+psycopg://app:devpass@localhost:5434/d5_migration_gate_local
docker compose --profile dev exec -T postgres_test psql -U app -d postgres \
  -c 'DROP DATABASE IF EXISTS d5_migration_gate_local'
docker compose --profile dev exec -T postgres_test psql -U app -d postgres \
  -c 'CREATE DATABASE d5_migration_gate_local'
D5_DATABASE_URL="$D5_DATABASE_URL" \
  DATABASE_URL="$D5_DATABASE_URL" \
  .venv/bin/python ops/ci/migration_gate.py --require-empty
# upgrade 후 같은 disposable DB의 version/extension/index catalog만 readback
D5_DATABASE_URL="$D5_DATABASE_URL" \
  DATABASE_URL="$D5_DATABASE_URL" \
  .venv/bin/python ops/ci/migration_gate.py --readback-only
docker compose --profile dev exec -T postgres_test psql -U app -d postgres \
  -c 'DROP DATABASE IF EXISTS d5_migration_gate_local'
# GitHub CI는 service host/port를 workflow가 주입한다. 위 localhost URL을 CI에 복사하지 않는다.
# canonical 운영 절차: docs/agent_runbook_vps.md의 D5 migration/readback 절
.venv/bin/ruff check apps/api
.venv/bin/python -m pyright --project pyrightconfig.json
.venv/bin/pytest -q
pnpm -C apps/web lint
pnpm -C apps/web test
pnpm -C apps/web build
.venv/bin/python scripts/export_openapi.py && pnpm -C packages/schemas run gen-dts
git diff --exit-code packages/schemas/openapi.json packages/schemas/index.d.ts
```

## PR CI 필수 job (Ready for Review)

| Job | 내용 |
|-----|------|
| `repo-guards` | guards, versions, **commitlint (hard)** |
| `python` | 빈 PostgreSQL Alembic upgrade·schema drift·catalog gate, ruff, pyright, pytest, bandit, pip-audit |
| `contract` | OpenAPI export + DTO drift |
| `web` | **eslint**, **vitest 전체**, build, a11y smoke, bundle, pnpm audit |
| `secrets-scan` | gitleaks |
| `semgrep` | Semgrep `p/ci` |
| `e2e` (별도 workflow) | Puppeteer E2E — 실패 시 PR을 차단하는 hard gate |
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

- `repo-guards` / `python` / `contract` / `web` / `e2e` / `secrets-scan` / `semgrep`
- (권장) CodeQL `analyze` matrix jobs
- (권장) `dto-verify` on main push

또는 `ops/ci/apply_main_branch_protection.sh`로 upsert한다(기존 `main-quality-gates` ruleset이 있으면 PUT, 없으면 POST).

```bash
bash ops/ci/apply_main_branch_protection.sh              # 기본: ginishuh/sogecon-app
bash ops/ci/apply_main_branch_protection.sh OWNER/REPO   # 다른 포크
```

Draft PR은 job이 skip되므로 Ready 전환 후 CI가 녹색인지 확인한다. `python` job의
migration gate는 테스트 fixture와 독립적으로 빈 PostgreSQL에서 실행되며,
`alembic_version`, `pg_extension`, `pg_class`/`pg_index`/`pg_am`/`pg_attribute`/
`pg_opclass` 구조적 catalog readback까지 통과해야 한다. 운영 readback도 같은
Python gate의 `--readback-only` 경로를 사용하므로 API 이미지 안에서 별도 `psql`
명령을 유지하지 않는다.

## Alembic migration/schema drift gate (D5)

`ops/ci/migration_gate.py`가 D5의 authoritative schema gate다.

- `--require-empty`: public table이 없는 PostgreSQL에서 `alembic upgrade head`를 실행한다.
- `--readback-only`: upgrade와 `alembic check`를 생략하고 current/head, extension,
  기대 index catalog만 읽는다. DB mutation이 없는 운영 readback 전용 모드다.
- upgrade 직후 `alembic check`를 실행해 현재 모델 metadata와 migration-created catalog의 drift를 검출한다. 모델에 표현 가능한 기존 PostgreSQL 인덱스는 metadata에 선언했고, 일반 drift를 숨기는 `include_object`/`compare_index` blanket 예외는 두지 않았다.
- `alembic_version`가 단일 head인지, `pg_trgm` extension이 존재하는지, 기존 5개와 D5의 2개 GIN trgm index가 public `members`의 기대 column에 있고 `gin_trgm_ops`를 사용하며 `pg_index.indpred IS NULL`, `indisvalid`·`indisready`·`indislive`인지 구조적으로 확인한다. `pg_indexes.indexdef` 문자열 포함 여부로 PASS를 만들지 않는다.
- `tests/api/test_migration_gate.py`는 전용 disposable PostgreSQL에 repository `apps/api/migrations/env.py`, `models.Base.metadata`, 실제 gate subprocess를 연결한다. 정상 head를 적용한 뒤 unmigrated column/table/index를 주입하면 실제 `alembic check`가 실패하고, 실패한 concurrent index와 valid same-name partial index도 readback gate가 nonzero가 되는 것을 고정한다.
- 기존 schema DB에는 `--require-empty` 없이 같은 upgrade를 적용하고 current/catalog를 readback한다. 역사적으로 남은 별도 인덱스는 삭제하거나 gate에서 숨기지 않고 별도 drift로 기록한다. 따라서 기존 local `appdb`의 `signup_activation_issue_logs` 추가 index 4개가 있으면 authoritative `alembic check`는 의도적으로 FAIL하며, D5에서 임의로 정렬하지 않는다.

`--require-empty`를 local에서 다시 실행할 때는 매번 정확한 disposable DB를
drop/create한다. `CREATE/DROP INDEX CONCURRENTLY`가 포함된
`autocommit_block()`에서 여러 pending revision 중 뒤 revision이 실패하면 앞선
revision이 부분 커밋된 상태와 중간 `alembic current`가 남을 수 있다. 실패 후에는
current와 invalid/not-ready index를 먼저 readback하고, 이름이 남은 invalid index를
`IF NOT EXISTS`로 덮으려 하지 말고 정확한 index만 concurrent drop 후 재실행한다.

관측된 CI 영향은 migration gate 약 1.6초, Python job 약 4분 15초였고 병렬화·캐시
구조 변경은 하지 않았다.

## 훅 통합 테스트

```bash
bash ops/ci/test_githooks.sh
# cloud-migrate fixed-entrypoint and shell-argument contract
bash ops/ci/test_cloud_migrate.sh
# 또는
make test-hooks
```

PR CI `repo-guards` job에서도 동일 스크립트를 실행한다.

## 검증 기록 (#174, 2026-07-11)

로컬 측정(WSL2, `bash ops/ci/test_githooks.sh`, 2026-07-11 18:00 KST):

| 항목 | 측정 | 목표 | 비고 |
|------|------|------|------|
| pre-commit docs-only | **12ms** | ≤15s | 통합 테스트 `timing summary` |
| pre-commit python+spaces | **466ms** | ≤15s | ruff 1파일(공백 경로) |
| commit-msg (pnpm+commitlint) | **841ms** | ≤2s | Log 라인 포함 메시지 |
| pre-push (py 변경, pyright+bandit) | 15–45s(환경 의존) | ≤90s | 전체 pyright 범위는 변경량 의존 |

훅 통합 테스트 신뢰성(false positive 제거 후):

- 제한 PATH 케이스는 `.githooks/{commit-msg,pre-commit,pre-push}`를 `$BASH_BIN`으로 직접 실행
- `expect_fail`은 exit **127**(명령 미발견)과 `[hooks]` 마커 없는 실패를 거부
- negative case는 `--contains`로 고유 오류 문구까지 고정(예: `pyright not available`)
- fixture는 생성·수정·삭제·rename으로 staged diff를 보장(변경 없는 `git add` 금지)
- setup/worktree/도구 준비 실패는 skip이 아니라 테스트 실패

변경 전(2026-07-11 이전): CI commitlint `|| true`, Web lint/전체 test 미실행, 훅 도구 누락 시 skip.  
변경 후: hard gate + 명시적 Web lint/test + 훅 실패 고정 + 통합 테스트가 실제 훅 실행을 검증.

CI(`repo-guards`) 근거: https://github.com/ginishuh/sogecon-app/actions/runs/29147120109 (`repo-guards` success, 2026-07-11).
