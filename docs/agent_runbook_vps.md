# VPS Agent Runbook (서버 운영자/에이전트용)

> English version: `docs/agent_runbook_vps_en.md`

본 문서는 VPS에 레포를 클론한 뒤 에이전트(Codex CLI/Claude)가 안전하게 배포/재배포 작업을 수행할 수 있도록 표준 절차를 제공합니다.

## 운영 토폴로지와 주 제어 흐름

- API: Docker 컨테이너 `alumni-api`
- PostgreSQL: Docker 컨테이너 `sogecon-db`
- Web: Docker가 아닌 systemd 서비스 `sogecon-web`; `/srv/www/sogecon/current`
  standalone 릴리스에서 실행
- `compose.yaml`은 로컬 dev/test 전용입니다. VPS 운영 컨테이너는
  `docker run` 기반 운영 스크립트로 관리합니다.

operator-confirmed current state는 migration 전까지 Web이 standalone
systemd release이고 API/PostgreSQL이 Docker인 구성입니다. 대표가 결정한
near-term target은 API/Web/PostgreSQL full Docker 구성입니다. 기존 D6
`cloud-start.sh` full-container guard를 target entry point로 사용하며,
standalone systemd release는 cutover 중 rollback fallback으로 보존합니다.

## 요구 사항
- Docker 설치
- Nginx/Caddy 등 리버스 프록시(127.0.0.1:3000/3001 프록시)
- 레포 위치: `/srv/sogecon-app` (권장)

## 1) 최초 준비(1회)
```bash
sudo mkdir -p /srv/sogecon-app && sudo chown $USER /srv/sogecon-app
git clone https://github.com/ginishuh/sogecon-app.git /srv/sogecon-app
cd /srv/sogecon-app

# 시크릿 파일 준비(레포 루트)
cp .env.api.example .env.api   # JWT_SECRET/DATABASE_URL/CORS_ORIGINS 등 값 채우기
cp .env.web.example .env.web   # 선택. Next 공개변수는 빌드타임 고정(참고용)

# 업로드 디렉터리(컨테이너 볼륨)
sudo mkdir -p /var/lib/sogecon/uploads
sudo chown 1000:1000 /var/lib/sogecon/uploads
```

## 2) Target 배포 경로 — full Docker(API + Web + PostgreSQL)
체크리스트(요약)
- [ ] `.env.api`에 `DATABASE_URL=postgresql+psycopg://…@sogecon-db:5432/…`
- [ ] Web image를 HTTPS `NEXT_PUBLIC_WEB_API_BASE`로 build/pull
- [ ] `API_INTERNAL_URL=http://alumni-api:3001` 등 Docker network runtime 값 준비
- [ ] image/env/network preflight 후에만 `sogecon-web` stop/disable
- [ ] `ops/cloud-start.sh`로 API healthy → Web healthy 순서 확인
- [ ] API/Web health와 representative browser flow readback

### 2.1 Migration 전 current state 및 rollback fallback

현재 operator-confirmed Web release는 아래 standalone 경로로 보존한다.
full-Docker cutover 전 확인하거나 rollback할 때 사용하며 target primary로
간주하지 않는다.

```bash
cd /srv/sogecon-app
git pull --ff-only origin main

NEXT_PUBLIC_WEB_API_BASE=https://api.<도메인> \
  pnpm -C apps/web install
NEXT_PUBLIC_WEB_API_BASE=https://api.<도메인> \
  pnpm -C apps/web build

RELEASE_BASE=/srv/www/sogecon SERVICE_NAME=sogecon-web \
  REPO_ROOT=/srv/sogecon-app CI=1 bash ops/web-deploy.sh
systemctl is-active --quiet sogecon-web
curl -fsS https://<도메인>/
```

`ops/web-deploy.sh`가 `/srv/www/sogecon/current`를 standalone release로
전환하고 systemd 서비스를 재시작한다. 이 worker는 운영 endpoint를 직접
확인하지 않았으며, 확인 결과를 기록할 때는 operator-provided current-state
evidence로 구분한다.

### 2.2 Full-Docker cutover 절차

실제 migration은 별도 승인된 운영 작업에서만 수행한다. 순서는 다음과 같다.

1. `NEXT_PUBLIC_WEB_API_BASE=https://api.<도메인>`을 지정해 Web image를
   build하거나 정확한 release tag의 Web image를 pull한다.
2. `.env.web`에 `API_INTERNAL_URL=http://alumni-api:3001`을 넣고 API/Web env
   file, Docker network를 준비한 뒤 `docker image inspect`, env-file 존재 확인,
   `docker network inspect`를 먼저 수행한다.
3. preflight가 통과한 뒤 cutover 시점에만 `sogecon-web` systemd를 stop/disable
   한다. preflight 전에 systemd를 중지하지 않는다.
4. `API_IMAGE=... WEB_IMAGE=... API_ENV_FILE=.env.api
   WEB_ENV_FILE=.env.web DOCKER_NETWORK=sogecon_net
   bash ops/cloud-start.sh`를 실행한다. script의 기존 full-container
   preflight와 API→Web health guard를 유지한다.
5. API/Web health endpoint와 대표 browser flow를 확인한다. 이 PR에서는 이
   migration과 production readback을 수행하지 않는다.

rollback 시에는 Web container를 stop/rm하고, 보존한 이전
`/srv/www/sogecon/current` symlink/release를 복구한 뒤
`systemctl enable --now sogecon-web`으로 systemd fallback을 재활성화한다.

### D6 cloud-start resource/health guard defaults

`ops/cloud-start.sh`는 image와 supplied env file, Docker network를 먼저
preflight한 뒤 기존 컨테이너를 중지한다. 두 실제 `docker run`에 다음 기본값을
적용하며 모두 환경변수로 override할 수 있다.

| 대상 | memory | cpus | pids-limit |
| --- | --- | --- | --- |
| API | `768m` | `1.0` | `256` |
| Web | `512m` | `1.0` | `256` |

공통으로 `json-file` `max-size=10m`, `max-file=5`,
`no-new-privileges=true`, `cap-drop ALL`, `restart unless-stopped`,
loopback-only publication을 적용한다. image healthcheck의 interval/timeout/
retries/start-period 기본값은 `10s/5s/9/15s`이고, API가 healthy가 되기 전에는
Web을 시작하지 않는다. 두 서비스 모두 120초 안에 healthy가 되어야 성공한다.

health가 없거나 `unhealthy`, `exited`, `dead`이거나 timeout이면 nonzero로
종료하며 제한된 inspect state와 최근 40줄 로그만 출력한다. env/config 전체를
inspect하지 않고 알려진 env-file/database 값은 로그에서 가린다. 자동 DB rollback이나
기존 컨테이너 복구는 하지 않는다.

`scripts/deploy-vps.sh`의 `HEALTH_TIMEOUT`은 외부 `curl` 재시도 횟수(정수 초)다.
Docker healthcheck duration은 `CONTAINER_HEALTH_TIMEOUT`(기본 `5s`)으로만
조정한다.

리소스 튜닝 예:

```bash
API_MEMORY=1g WEB_CPUS=1.5 HEALTH_WAIT_TIMEOUT=180 \
  API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
  API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  DOCKER_NETWORK=sogecon_net bash ops/cloud-start.sh
```

운영 readback은 `docker inspect`에서 `User`, `HostConfig.Memory/NanoCpus/PidsLimit`,
`LogConfig`, `SecurityOpt`, `CapDrop`, `State.Health`, `RestartPolicy`,
`NetworkSettings.Ports`, `Mounts`, `NetworkSettings.Networks`를 확인한다.
실패 시 D6+ HEALTHCHECK가 포함된 정확한 이전 API/Web image tag를 현재
`cloud-start.sh`에 넣어 재실행한다. pre-D6 이미지처럼 HEALTHCHECK가 없는
태그로 롤백해야 하면 해당 이미지와 함께 배포된 pre-D6 deployment script/release
checkout으로 롤백한다. D6+ 롤백은 두 이미지와 D6+ `cloud-start.sh`가 matched
release set이며, 두 이미지 모두 healthy라는 성공 출력이 완료 증거다.

### 2.3 D4 게시글 공개성 배포 전 read-only audit

D4의 공개성 계약은 board 4종은 `published_at`과 무관하게 공개하고,
`notice`/`news` 및 레거시·미지 카테고리는 발행일시가 현재 시각 이하일 때만
공개한다. 배포 전에 운영 DB에서 아래 조회만 실행해 자동 수정 없이 결과를
확인한다.

```sql
SELECT category,
       count(*) AS total,
       count(*) FILTER (WHERE published_at IS NULL) AS unpublished_count,
       count(*) FILTER (WHERE published_at IS NOT NULL) AS dated_count,
       count(*) FILTER (
           WHERE category IN ('notice', 'news')
             AND published_at > NOW()
       ) AS scheduled_count,
       min(created_at) AS first_created_at,
       max(created_at) AS last_created_at
FROM posts
WHERE category IS NULL
   OR category NOT IN (
       'discussion', 'question', 'share', 'congrats', 'notice', 'news'
   )
   OR (category IN ('notice', 'news') AND published_at IS NULL)
   OR (category IN ('notice', 'news') AND published_at > NOW())
GROUP BY category
ORDER BY category NULLS FIRST;
```

판정 기준:

- 결과가 없으면 공개성 계약 전환으로 사라질 후보가 없는 것으로 기록하고 계속한다.
- `unpublished_count > 0`인 행이 하나라도 있으면 배포를 멈추고 category·게시글 ID를
  별도 데이터 정리 작업으로 이관한다. 이 PR이나 배포 절차에서 자동 backfill하지 않는다.
- `dated_count > 0`인 NULL/미지 카테고리도 레거시 데이터로 기록하고 별도 정리 여부를
  결정한다. 기존 글의 의미를 추측해 category를 변환하지 않는다.
- `scheduled_count > 0`인 `notice`/`news`는 정상적인 예약 발행 건이다. 발행 시각 전에는
  공개 목록·상세에서 숨겨지는 것이 의도된 동작이므로, 건수와 게시글 ID를 배포 기록에
  남기고 데이터 변환 없이 계속한다.

조회 결과와 판단을 배포 기록에 남긴 뒤 기존 릴리스 태그를 롤백 대상으로 보존한다.

### D5 Alembic·검색 인덱스 migration 운영 규칙

배포 이미지의 `ops/cloud-migrate.sh`가 기본값으로
`alembic -c apps/api/alembic.ini upgrade head`를 실행한다. D5 revision
`d5f2a1c9e7b3`는 `pg_trgm` extension을 확인·생성하고
`student_id`·`company` GIN index를 `CREATE INDEX CONCURRENTLY`로 만든다.
따라서 이 migration을 별도 트랜잭션으로 감싸거나 `--sql` 출력만으로 적용하지
않는다. API 이미지의 고정 uvicorn entrypoint는 운영 API 실행 계약이므로
전역적으로 바꾸지 않는다. 대신 `cloud-migrate.sh`가 `docker run`에서
`--entrypoint /bin/sh`를 명시하고 `IMAGE -lc "$ALEMBIC_CMD"`를 실행해
one-shot migration으로 종료되게 한다. 인덱스 build 중에는 lock·build 상태를
관찰한다.

적용 후에는 API 재기동 전 같은 API 이미지에 포함된 Python gate를 사용해
version과 검색 catalog를 readback한다. `--readback-only`는 upgrade와
`alembic check`를 건너뛰고 DB를 변경하지 않으며, Alembic current/head,
`pg_trgm`, 기대 index의 public table·column·access method·operator class와
`pg_index.indpred IS NULL`, `indisvalid`·`indisready`·`indislive`를
PostgreSQL catalog에서 구조적으로
확인한다. API 이미지 내부에서 `psql`을 호출하거나 `pg_indexes.indexdef`
문자열을 파싱하지 않는다.

```bash
docker run --rm --entrypoint /bin/sh --network sogecon_net --env-file .env.api \
  "$API_IMAGE" -lc \
  'python ops/ci/migration_gate.py --readback-only'
```

D5 rollback은 애플리케이션 릴리스 rollback과 별개로 승인 후
`ALEMBIC_CMD='alembic -c apps/api/alembic.ini downgrade -1' \
  bash ops/cloud-migrate.sh`로 실행한다. 두 GIN index만 `DROP INDEX CONCURRENTLY`로
역순 제거하고, 기존 검색 index가 사용하므로 `pg_trgm` extension은 제거하지
않는다. 운영 DB mutation은 이 runbook을 따르는 운영자만 수행하며, 이번 D5
검증에서는 실행하지 않는다.

실패한 `CREATE INDEX CONCURRENTLY`는 이름이 남은 invalid/not-ready index를
만들 수 있다. 이 상태에서 `CREATE INDEX CONCURRENTLY IF NOT EXISTS`를 다시
실행하면 이름 충돌로 실제 재생성이 되지 않을 수 있다. 먼저 위
`--readback-only` gate로 exact index 이름과 catalog flag를 확인하고, 승인된
운영 절차에서 해당 invalid index만 `DROP INDEX CONCURRENTLY`로 제거한 뒤
`cloud-migrate.sh`를 재실행하고 다시 readback한다. 다른 index나 데이터를
삭제하지 않으며, 여러 pending revision 중 뒤 revision이 실패하면 앞선
revision이 `autocommit_block()` 때문에 이미 커밋되어 중간 `alembic current`가
남을 수 있으므로 current를 확인한 후 그 지점부터 재개한다.

`--require-empty`는 CI와 local disposable DB에서만 사용한다. 재실행 전에
정확한 전용 DB를 drop/create하고, 기존 `appdb`·`appdb_test` 또는 운영 DB를
대상으로 하지 않는다.

```bash
# 예시: local disposable PostgreSQL에서만 실행
docker compose --profile dev exec -T postgres_test \
  psql -U app -d postgres -c 'DROP DATABASE IF EXISTS d5_migration_gate_local'
docker compose --profile dev exec -T postgres_test \
  psql -U app -d postgres -c 'CREATE DATABASE d5_migration_gate_local'
DATABASE_URL=postgresql+psycopg://app:devpass@localhost:5434/d5_migration_gate_local \
  .venv/bin/python ops/ci/migration_gate.py --require-empty
DATABASE_URL=postgresql+psycopg://app:devpass@localhost:5434/d5_migration_gate_local \
  .venv/bin/python ops/ci/migration_gate.py --readback-only
```

마지막으로 전용 DB를 drop하고, migration 실패 시 남은 invalid index와 중간
`alembic current`를 배포 기록에 남긴다.

### Full-Docker target 전체 명령

다음 image build/start 흐름은 target full-Docker 운영 경로다. 실제 실행은
별도 승인된 migration 작업에서만 수행한다.

```bash
cd /srv/sogecon-app
git pull --ff-only origin main

export TAG=$(git rev-parse --short HEAD)
export IMAGE_PREFIX=local/sogecon
export API_IMAGE="${IMAGE_PREFIX}/alumni-api:${TAG}"
export WEB_IMAGE="${IMAGE_PREFIX}/alumni-web:${TAG}"

docker network inspect sogecon_net >/dev/null 2>&1 || docker network create sogecon_net

IMAGE_TAG="$TAG" IMAGE_PREFIX="$IMAGE_PREFIX" \
  NEXT_PUBLIC_WEB_API_BASE=https://api.<도메인> \
  bash ops/cloud-build.sh
ENV_FILE=.env.api API_IMAGE="$API_IMAGE" DOCKER_NETWORK=sogecon_net bash ops/cloud-migrate.sh
docker image inspect "$API_IMAGE" "$WEB_IMAGE"
test -f .env.api && test -f .env.web
grep -q '^API_INTERNAL_URL=http://alumni-api:3001$' .env.web
docker network inspect sogecon_net >/dev/null
# cutover point: only after the preflight above
sudo systemctl stop sogecon-web
sudo systemctl disable sogecon-web
API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
  API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  DOCKER_NETWORK=sogecon_net \
  bash ops/cloud-start.sh

curl -fsS https://api.<도메인>/healthz
curl -fsS https://<도메인>/
```

## 3) Full-Docker target 경로 B — 외부 레지스트리 pull
레지스트리를 반드시 써야 하는 경우에만 사용합니다.
```bash
cd /srv/sogecon-app
git pull --ff-only origin main

export PREFIX=<registry>/<namespace>/<repo>
export TAG=<커밋SHA7 또는 릴리스 태그>
export API_IMAGE="${PREFIX}/alumni-api:${TAG}"
export WEB_IMAGE="${PREFIX}/alumni-web:${TAG}"

docker network inspect sogecon_net >/dev/null 2>&1 || docker network create sogecon_net
docker pull "$API_IMAGE"
docker pull "$WEB_IMAGE"

ENV_FILE=.env.api API_IMAGE="$API_IMAGE" DOCKER_NETWORK=sogecon_net bash ops/cloud-migrate.sh
API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
  API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  DOCKER_NETWORK=sogecon_net \
  bash ops/cloud-start.sh

curl -fsS https://api.<도메인>/healthz
curl -fsS https://<도메인>/

# 비상 롤백
export PREV=<stable-tag>
export API_IMAGE="${PREFIX}/alumni-api:${PREV}"
export WEB_IMAGE="${PREFIX}/alumni-web:${PREV}"

docker pull "$API_IMAGE"
docker pull "$WEB_IMAGE"
API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
  API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  DOCKER_NETWORK=sogecon_net \
  bash ops/cloud-start.sh
```

## 4) 쿠키/도메인 전환 스위치
- 서브도메인 단계: `COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true`
- 별도 도메인(교차 사이트): `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (HTTPS 필수)
- 설정 위치: `.env.api` → `apps/api/main.py`의 `SessionMiddleware`에 반영됨

## 5) Web standalone rollback fallback(Next.js standalone + systemd + Nginx)

현재 operator-confirmed migration 전 상태와 full-Docker Web rollback을 위해
Next.js `standalone` 산출물을 systemd 서비스로 보존합니다. full-Docker target의
영구 primary는 이 systemd 경로가 아닙니다.

사전 준비(1회)
- Node 고정 설치: `asdf plugin add nodejs && asdf install nodejs 24.12.0 && asdf global nodejs 24.12.0`
- systemd 유닛 배치: `sudo cp ops/systemd/sogecon-web.service /etc/systemd/system/ && sudo systemctl enable sogecon-web`
- Nginx 프록시: `ops/nginx/nginx-site-web.conf` 참고(도메인/인증서 경로 수정 후 적용)
- 릴리스 경로 생성: `sudo mkdir -p /srv/www/sogecon/releases && sudo chown $USER /srv/www/sogecon -R`

### sudoers 설정(무중단 배포/롤백용)
systemd 재시작에 비밀번호 프롬프트가 발생하지 않도록, 전용 sudoers 항목을 추가합니다.
```
sudo visudo -f /etc/sudoers.d/sogecon-web
```
내용 예시(사용자/서비스명에 맞게 조정):
```
sogecon ALL=(ALL) NOPASSWD: /bin/systemctl daemon-reload, /bin/systemctl restart sogecon-web, /bin/systemctl status sogecon-web
```

배포 절차
1. 레포 루트에서 웹 빌드: `NEXT_PUBLIC_WEB_API_BASE=https://api.<도메인> pnpm -C apps/web install && NEXT_PUBLIC_WEB_API_BASE=https://api.<도메인> pnpm -C apps/web build`
2. 산출물 전개/링크 전환: `bash ops/web-deploy.sh` (환경변수: `RELEASE_BASE`, `SERVICE_NAME` 커스터마이즈 가능)
3. 상태 확인: `systemctl status sogecon-web` (active), `curl -i http://127.0.0.1:3000/` (200)

롤백 절차
- 직전 릴리스로 링크 전환 및 재시작: `bash ops/web-rollback.sh`

디렉터리 구조(예시)
```
/srv/www/sogecon/
  ├── current -> releases/20251104183010
  └── releases/
      └── 20251104183010/   (.next/standalone 전개본 + apps/web/.next/static + apps/web/public)
```

주의사항
- `NEXT_PUBLIC_*` 값은 빌드 타임에 고정됩니다. 환경 변경 시 빌드 재실행 필요.
- 보안 헤더는 Next와 Nginx 모두 설정되므로 중복/충돌 항목을 점검하세요.
- 헬스 실패 시 `journalctl -u sogecon-web -e` 및 Nginx 에러 로그를 확인하세요.

### 유지보수(운영 팁)
- 오래된 릴리스 정리(30일 이상):
  - `find /srv/www/sogecon/releases -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +`
- 로그 확인/로테이션:
  - 앱: `journalctl -u sogecon-web -f`
  - Nginx: `/var/log/nginx/access.log`, `/var/log/nginx/error.log` (logrotate 기본 적용)
  - journal 용량 제한: `/etc/systemd/journald.conf`의 `SystemMaxUse` 등 조정
- 모니터링 초안:
  - systemd 상태/재시작 횟수: `systemctl show -p ActiveState,RestartCount sogecon-web`
  - 헬스엔드포인트를 크론/외부 모니터로 주기 확인(200 응답)

### GitHub CD 정책
- GitHub Actions 기반 배포 워크플로우(`build-push`, `deploy`, `web-standalone-*`)는 사용하지 않습니다.
- GitHub는 CI/검증 용도로만 사용하고, 실제 배포는 VPS 온박스(운영자 또는 에이전트)가 실행합니다.

### 경로 정책(/opt vs 레포 내부)
- 기본(권장): `/srv/www/sogecon`에 릴리스 전개, `/srv/www/sogecon/current` 심볼릭 링크 운용
  - 장점: 운영/롤백이 레포 작업트리와 분리되어 안전, 권한 관리 용이
  - 단점: 초기 경로/권한 준비 필요, 백업/모니터링 경로가 분리됨
- 대안(레포 내부): `RELEASE_BASE=/srv/sogecon-app/.releases/web`
  - 사용 시 조치: `ops/web-deploy.sh` 실행 시 `RELEASE_BASE` 환경변수 지정, `ops/systemd/sogecon-web.service`의 `WorkingDirectory`를 동일 경로로 변경

## 6) 트러블슈팅
- 웹 공개변수 반영 안 됨: Next `NEXT_PUBLIC_*`는 빌드타임 고정 — 반드시 재빌드 필요
- 업로드 권한 오류: `/var/lib/sogecon/uploads` 소유자/권한 확인(UID 1000)
- 헬스체크 실패: Nginx 프록시 대상(127.0.0.1:3000/3001)·TLS 인증서 경로 확인

## 참고 문서
- 배포 절차(상세): `ops/deploy_api.md`, `ops/deploy_web.md`
- Nginx 예시: `ops/nginx-examples/`
- CI 워크플로: `.github/workflows/ci.yml`, `.github/workflows/dto-verify.yml`, `.github/workflows/codeql.yml`
- 에이전트 실행 SSOT: `AGENTS.md`
- 운영 절차: 이 문서와 `docs/security_hardening.md`
