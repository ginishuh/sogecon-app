# VPS Agent Runbook (for Docker + Nginx servers)

This runbook helps an on‑box agent (Codex CLI/Claude) deploy and redeploy the app on a VPS.

## Operational topology and primary control flow

- API: Docker container `alumni-api`
- PostgreSQL: Docker container `sogecon-db`
- Web: systemd service `sogecon-web`, running the standalone release at
  `/srv/www/sogecon/current`; Web is not a Docker service on the current VPS.
- `compose.yaml` is local dev/test only. VPS operational containers are managed
  by `docker run` deployment scripts.

The operator-confirmed current state is a systemd standalone Web release with
Docker API/PostgreSQL until migration. The accepted near-term target is full
Docker for API, Web, and PostgreSQL. The existing D6 full-container guards in
`cloud-start.sh` are the target entry point; the standalone systemd release is
preserved as a cutover rollback fallback, not the target primary architecture.

## Requirements
- Docker installed
- Reverse proxy (Nginx/Caddy) forwarding 443 → 127.0.0.1:3000 (Web) and 127.0.0.1:3001 (API)
- Repo path on server: `/srv/sogecon-app` (recommended)

## 1) One‑time setup
```bash
sudo mkdir -p /srv/sogecon-app && sudo chown $USER /srv/sogecon-app
git clone https://github.com/ginishuh/sogecon-app.git /srv/sogecon-app
cd /srv/sogecon-app

# Secrets (repo root; do NOT commit)
cp .env.api.example .env.api   # fill JWT_SECRET, DATABASE_URL, CORS_ORIGINS, etc.
cp .env.web.example .env.web   # optional; Next public envs are build-time only

# Uploads volume on host → container /app/uploads
sudo mkdir -p /var/lib/sogecon/uploads
sudo chown 1000:1000 /var/lib/sogecon/uploads
```

## 2) Target deploy path — full Docker (API + Web + PostgreSQL)
Checklist (quick)
- [ ] `.env.api` uses container DNS in `DATABASE_URL` (e.g., `sogecon-db`)
- [ ] Build/pull the Web image with an HTTPS `NEXT_PUBLIC_WEB_API_BASE`
- [ ] Prepare `API_INTERNAL_URL=http://alumni-api:3001` or the approved Docker-network runtime value
- [ ] Preflight images, env files, and network before stopping/disabling `sogecon-web`
- [ ] Use `ops/cloud-start.sh` and confirm API healthy before Web healthy
- [ ] Read back API/Web health and representative browser flows

### 2.1 Current state and rollback fallback

The operator-confirmed current Web release is preserved through the standalone
systemd path below until cutover. Use it for pre-cutover verification or
rollback; it is not the target primary path.

```bash
cd /srv/sogecon-app
git pull --ff-only origin main

NEXT_PUBLIC_WEB_API_BASE=https://api.<domain> \
  pnpm -C apps/web install
NEXT_PUBLIC_WEB_API_BASE=https://api.<domain> \
  pnpm -C apps/web build

RELEASE_BASE=/srv/www/sogecon SERVICE_NAME=sogecon-web \
  REPO_ROOT=/srv/sogecon-app CI=1 bash ops/web-deploy.sh
systemctl is-active --quiet sogecon-web
curl -fsS https://<domain>/
```

`ops/web-deploy.sh` switches `/srv/www/sogecon/current` to a standalone release
and restarts systemd. This worker did not access production endpoints; any
recorded 200 result is operator-provided current-state evidence.

### 2.2 Full-Docker cutover procedure

Perform the actual migration only as a separately approved operations task:

1. Build the Web image with `NEXT_PUBLIC_WEB_API_BASE=https://api.<domain>` or
   pull the exact release-tagged Web image.
2. Put `API_INTERNAL_URL=http://alumni-api:3001` in `.env.web`, prepare the
   API/Web env files and Docker network, then run image inspect, env-file
   existence checks, and network inspect.
3. Only after that preflight, stop and disable `sogecon-web` at the cutover
   point. Do not stop systemd before preflight.
4. Run `API_IMAGE=... WEB_IMAGE=... API_ENV_FILE=.env.api
   WEB_ENV_FILE=.env.web DOCKER_NETWORK=sogecon_net bash ops/cloud-start.sh`.
   The `API_INTERNAL_URL` value is read from `.env.web`; the existing
   full-container preflight and API→Web health guard remain active.
5. Verify API/Web health endpoints and representative browser flows. This PR
   performs no production migration or production readback.

For rollback, stop/remove the Web container, restore the preserved
`/srv/www/sogecon/current` symlink/release, and run
`systemctl enable --now sogecon-web` to re-enable the systemd fallback.

### D6 cloud-start resource and health guard defaults

`ops/cloud-start.sh` preflights both images, supplied env files, and the Docker
network before stopping any existing container. It applies these overrideable
defaults to both actual `docker run` commands:

| service | memory | cpus | pids-limit |
| --- | --- | --- | --- |
| API | `768m` | `1.0` | `256` |
| Web | `512m` | `1.0` | `256` |

Both services also use the `json-file` driver with `max-size=10m` and
`max-file=5`, `no-new-privileges=true`, `cap-drop ALL`,
`restart unless-stopped`, and loopback-only host publication. Health defaults
are interval/timeout/retries/start-period `10s/5s/9/15s`; Web is not started
until API is healthy, and both services must become healthy within 120 seconds.

Missing health, `unhealthy`, `exited`, `dead`, or timeout exits nonzero and prints
only concise inspect state plus the most recent 40 log lines. It does not inspect
or print the complete environment/configuration, and known env-file/database
values are redacted from the bounded logs. It does not automatically roll back
the database or silently restore containers.

The deploy wrapper's `HEALTH_TIMEOUT` is an integer number of external curl
wait seconds. Docker healthcheck duration uses the distinct
`CONTAINER_HEALTH_TIMEOUT` variable (default `5s`).

For tuning, override only the required values:

```bash
API_MEMORY=1g WEB_CPUS=1.5 HEALTH_WAIT_TIMEOUT=180 \
  API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
  API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  DOCKER_NETWORK=sogecon_net bash ops/cloud-start.sh
```

Operational readback should use `docker inspect` for `User`,
`HostConfig.Memory/NanoCpus/PidsLimit`, `LogConfig`, `SecurityOpt`, `CapDrop`,
`State.Health`, `RestartPolicy`, `NetworkSettings.Ports`, `Mounts`, and
`NetworkSettings.Networks`. On failure, rerun the same script with the exact
previous D6+ API/Web image tags and the current D6+ `cloud-start.sh`. D6+
rollback requires images that contain HEALTHCHECK definitions and the
image/script pair is a matched release set. For a pre-D6 image without
HEALTHCHECK, use the corresponding pre-D6 deployment script/release checkout
instead. Both images becoming healthy is authoritative rollback completion
evidence.

### Full-Docker target local-build command

```bash
TAG=$(git rev-parse --short HEAD)
IMAGE_PREFIX=local/sogecon
API_IMAGE="${IMAGE_PREFIX}/alumni-api:${TAG}"
WEB_IMAGE="${IMAGE_PREFIX}/alumni-web:${TAG}"
IMAGE_TAG="$TAG" IMAGE_PREFIX=local/sogecon \
  NEXT_PUBLIC_WEB_API_BASE=https://api.<domain> \
  bash ops/cloud-build.sh
ENV_FILE=.env.api API_IMAGE="$API_IMAGE" DOCKER_NETWORK=sogecon_net \
  bash ops/cloud-migrate.sh
API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
  API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  DOCKER_NETWORK=sogecon_net bash ops/cloud-start.sh
```

## 3) Full-Docker target path B — pull from external registry
Use this path only when you explicitly need a registry.
```bash
cd /srv/sogecon-app
git pull --ff-only origin main

PREFIX=<registry>/<namespace>/<repo>
TAG=<commit-sha-or-release>
API_IMAGE="${PREFIX}/alumni-api:${TAG}"
WEB_IMAGE="${PREFIX}/alumni-web:${TAG}"

docker network inspect sogecon_net >/dev/null 2>&1 || docker network create sogecon_net
docker pull "$API_IMAGE"
docker pull "$WEB_IMAGE"

ENV_FILE=.env.api API_IMAGE="$API_IMAGE" DOCKER_NETWORK=sogecon_net bash ops/cloud-migrate.sh
API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
  API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  DOCKER_NETWORK=sogecon_net \
  bash ops/cloud-start.sh

curl -fsS https://api.<domain>/healthz
curl -fsS https://<domain>/

# Emergency rollback
PREV=<stable-tag>
API_IMAGE="${PREFIX}/alumni-api:${PREV}"
WEB_IMAGE="${PREFIX}/alumni-web:${PREV}"

docker pull "$API_IMAGE"
docker pull "$WEB_IMAGE"
API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
  API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  DOCKER_NETWORK=sogecon_net \
  bash ops/cloud-start.sh
```

## 4) D5 migration and catalog readback

The Korean runbook is the canonical policy source; the D5 operational details are
also reproduced here so an English-reading operator does not skip the safety steps:
[D5 migration/readback procedure](agent_runbook_vps.md).

Run the migration as a one-shot container command before restarting the API. The
repository script explicitly overrides the image's fixed uvicorn entrypoint with
`/bin/sh -lc`; do not change the global API entrypoint or run a shell command after
the image without the override.

```bash
cd /srv/sogecon-app
ENV_FILE=.env.api API_IMAGE="$API_IMAGE" DOCKER_NETWORK=sogecon_net \
  bash ops/cloud-migrate.sh
```

After the one-shot migration exits successfully, use the same API image and the
same `postgresql+psycopg://` `DATABASE_URL` for the non-mutating operational readback
before restarting the API. This also explicitly bypasses the fixed entrypoint:

```bash
docker run --rm --network sogecon_net --env-file .env.api \
  --entrypoint /bin/sh "$API_IMAGE" -lc \
  'python ops/ci/migration_gate.py --readback-only'
```

The readback must show a single Alembic head, `pg_trgm`, and each expected
`members` GIN index with the expected column and `gin_trgm_ops`. Each expected
index must be a full index (`pg_index.indpred IS NULL`) and must have
`indisvalid=true`, `indisready=true`, and `indislive=true`. A valid partial index
with the expected name, table, column, access method, and operator class is not
acceptable.

If `CREATE INDEX CONCURRENTLY` fails, inspect the exact catalog row before retrying.
An invalid, not-ready, not-live, wrong-method, or partial index with the expected
name can cause `CREATE INDEX CONCURRENTLY IF NOT EXISTS` to skip the desired full
index. Approve only the exact expected full index. Otherwise run the narrow,
non-destructive recovery sequence: read back the exact index name, run
`DROP INDEX CONCURRENTLY IF EXISTS public.<exact-index-name>`, retry the migration,
then run the Python readback again. Do not drop unrelated indexes or use a blanket
catalog exception.

`autocommit_block()` can commit earlier revisions before a later concurrent
revision fails. After such a failure, `alembic current` may show an intermediate
revision and the database may be partially applied. Read back the current revision
and catalog state first, then resume or roll back according to the exact state.

`--require-empty` is only for a named disposable local database. Drop and recreate
that exact database before rerunning it; never run it against `appdb`, `appdb_test`,
production, or a VPS operational database.

## 5) Cookie/domain switches
- Subdomain stage: `COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true`.
- Cross‑site domains: `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (HTTPS required).
- Location: `.env.api` → applied by `SessionMiddleware` in `apps/api/main.py`.

## 6) Web standalone rollback fallback (Next.js standalone + systemd + Nginx)

The operator-confirmed pre-migration state and full-Docker Web rollback use the
Next.js `standalone` build as a systemd service. The permanent near-term target
primary is full Docker, not this systemd path.

One‑time setup
- Pin Node: `asdf plugin add nodejs && asdf install nodejs 24.12.0 && asdf global nodejs 24.12.0`
- systemd unit: `sudo cp ops/systemd/sogecon-web.service /etc/systemd/system/ && sudo systemctl enable sogecon-web`
- Nginx proxy: see `ops/nginx/nginx-site-web.conf` (adjust server_name, cert paths)
- Release dirs: `sudo mkdir -p /srv/www/sogecon/releases && sudo chown $USER /srv/www/sogecon -R`

### sudoers (for passwordless restarts)
To avoid prompts during deploy/rollback:
```
sudo visudo -f /etc/sudoers.d/sogecon-web
```
Example (adjust user/service names):
```
sogecon ALL=(ALL) NOPASSWD: /bin/systemctl daemon-reload, /bin/systemctl restart sogecon-web, /bin/systemctl status sogecon-web
```

Deploy steps
1) Build at repo root: `NEXT_PUBLIC_WEB_API_BASE=https://api.<domain> pnpm -C apps/web install && NEXT_PUBLIC_WEB_API_BASE=https://api.<domain> pnpm -C apps/web build`
2) Rollout + symlink switch: `bash ops/web-deploy.sh` (env: `RELEASE_BASE`, `SERVICE_NAME`)
3) Verify: `systemctl status sogecon-web` (active), `curl -i http://127.0.0.1:3000/` (200)

Rollback
- Switch to previous release and restart: `bash ops/web-rollback.sh`

Directory layout (example)
```
/srv/www/sogecon/
  ├── current -> releases/20251104183010
  └── releases/
      └── 20251104183010/   (.next/standalone + apps/web/.next/static + apps/web/public)
```

Notes
- `NEXT_PUBLIC_*` values are build‑time; rebuild when changing them.
- Keep security headers consistent between Next and Nginx.
- On failures, check `journalctl -u sogecon-web -e` and Nginx error logs.

### Maintenance
- Clean old releases (older than 30 days):
  - `find /srv/www/sogecon/releases -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +`
- Logs/rotation:
  - App: `journalctl -u sogecon-web -f`
  - Nginx: `/var/log/nginx/access.log`, `/var/log/nginx/error.log` (logrotate)
  - Journal size: tune `SystemMaxUse` in `/etc/systemd/journald.conf`
- Monitoring ideas:
  - systemd state/restart count: `systemctl show -p ActiveState,RestartCount sogecon-web`
  - External health probe for `/` endpoint (expect 200)

### GitHub CD policy
- GitHub Actions deployment workflows (`build-push`, `deploy`, `web-standalone-*`) are no longer used.
- GitHub is used for CI/verification only; deployment runs on the VPS (operator or on-box agent).

### Path policy (/opt vs in‑repo)
- Default (recommended): deploy releases to `/srv/www/sogecon`, operate via `/srv/www/sogecon/current` symlink
  - Pros: clean separation from repo tree, safer rollouts/rollbacks, simpler permissions
  - Cons: one‑time path/permissions setup, backup/monitoring split
- Alternative (in repo): `RELEASE_BASE=/srv/sogecon-app/.releases/web`
  - How‑to: pass `RELEASE_BASE` to `ops/web-deploy.sh` and update `WorkingDirectory` in `ops/systemd/sogecon-web.service` accordingly

## 7) Troubleshooting
- Next public envs not applied: `NEXT_PUBLIC_*` are build‑time only — rebuild required.
- Uploads permission error: ensure `/var/lib/sogecon/uploads` owner uid 1000.
- Health check fails: verify Nginx upstream to 127.0.0.1:3000/3001 and TLS cert paths.

## 8) References
- Detailed deploy docs: `ops/deploy_api.md`, `ops/deploy_web.md`
- Nginx examples: `ops/nginx-examples/`
- CI workflows: `.github/workflows/ci.yml`, `.github/workflows/dto-verify.yml`, `.github/workflows/codeql.yml`
- Agent execution SSOT: `AGENTS.md`
- Operations procedures: this runbook and `docs/security_hardening.md`
