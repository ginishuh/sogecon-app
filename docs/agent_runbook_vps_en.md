# VPS Agent Runbook (for Docker + Nginx servers)

This runbook helps an on‑box agent (Codex CLI/Claude) deploy and redeploy the app on a VPS using container images (GHCR).

## Requirements
- Docker installed; ability to `docker login ghcr.io` (via PAT or injected token)
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
sudo mkdir -p /var/lib/segecon/uploads
sudo chown 1000:1000 /var/lib/segecon/uploads
```

## 2) Deploy path A — via GitHub Actions (recommended)
1) CI runs `build-push` to push images to GHCR.
2) Manually run `deploy` workflow:
   - Inputs: `tag` (commit SHA or release tag), `environment=prod`, `skip_migrate` (optional)
   - The workflow SSHes into the VPS and runs: pull → migrate → restart → health checks

GitHub Environment `prod` (suggested)
- Variables: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WEB_API_BASE`, and other `NEXT_PUBLIC_*` as needed. (Recommended) `DOCKER_NETWORK` (e.g., `sogecon_net`).
- Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, optional `SSH_PORT`, `GHCR_PAT` (read:packages)

## 3) Deploy path B — manual on the server
Checklist (quick)
- [ ] Dedicated network exists (`sogecon_net`)
- [ ] `.env.api` uses container DNS in `DATABASE_URL` (e.g., `sogecon-db`)
- [ ] Pull images → migrate → restart order
- [ ] Health 200 (allow warm‑up ≤90s)
```bash
cd /srv/sogecon-app
PREFIX=ghcr.io/<owner>/<repo>
TAG=<commit-sha-or-release>

# 1) Pull images
docker pull $PREFIX/alumni-api:$TAG
docker pull $PREFIX/alumni-web:$TAG

# 2) DB migration (when schema changed)
docker network inspect sogecon_net >/dev/null 2>&1 || docker network create sogecon_net
API_IMAGE=$PREFIX/alumni-api:$TAG ENV_FILE=.env.api DOCKER_NETWORK=sogecon_net \
  bash ./ops/cloud-migrate.sh

# 3) Restart services
API_IMAGE=$PREFIX/alumni-api:$TAG \
WEB_IMAGE=$PREFIX/alumni-web:$TAG \
API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
DOCKER_NETWORK=sogecon_net \
  bash ./ops/cloud-start.sh

# 4) Health checks (retry up to 90s)
for i in {1..90}; do code=$(curl -sf -o /dev/null -w "%{http_code}" https://api.<domain>/healthz || true); [ "$code" = 200 ] && break; sleep 1; done
for i in {1..90}; do code=$(curl -sf -o /dev/null -w "%{http_code}" https://<domain>/ || true); [ "$code" = 200 ] && break; sleep 1; done

## Emergency rollback
```bash
PREV=<stable-tag>
docker pull $PREFIX/alumni-api:$PREV
docker pull $PREFIX/alumni-web:$PREV
API_IMAGE=$PREFIX/alumni-api:$PREV WEB_IMAGE=$PREFIX/alumni-web:$PREV \
  DOCKER_NETWORK=sogecon_net API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  bash ./ops/cloud-start.sh
```
```

## 4) Cookie/domain switches
- Subdomain stage: `COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true`.
- Cross‑site domains: `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (HTTPS required).
- Location: `.env.api` → applied by `SessionMiddleware` in `apps/api/main.py`.

## 5) Web without container (Next.js standalone + systemd + Nginx)

Run the Next.js `standalone` build as a systemd service. DB/API containers remain unchanged.

One‑time setup
- Pin Node: `asdf plugin add nodejs && asdf install nodejs 22.17.1 && asdf global nodejs 22.17.1`
- systemd unit: `sudo cp ops/systemd/sogecon-web.service /etc/systemd/system/ && sudo systemctl enable sogecon-web`
- Nginx proxy: see `ops/nginx/nginx-site-web.conf` (adjust server_name, cert paths)
- Release dirs: `sudo mkdir -p /opt/sogecon/web/releases && sudo chown $USER /opt/sogecon/web -R`

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
1) Build at repo root: `pnpm -C apps/web install && pnpm -C apps/web build`
2) Rollout + symlink switch: `bash ops/web-deploy.sh` (env: `RELEASE_BASE`, `SERVICE_NAME`)
3) Verify: `systemctl status sogecon-web` (active), `curl -i http://127.0.0.1:3000/` (200)

Rollback
- Switch to previous release and restart: `bash ops/web-rollback.sh`

Directory layout (example)
```
/opt/sogecon/web/
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
  - `find /opt/sogecon/web/releases -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +`
- Logs/rotation:
  - App: `journalctl -u sogecon-web -f`
  - Nginx: `/var/log/nginx/access.log`, `/var/log/nginx/error.log` (logrotate)
  - Journal size: tune `SystemMaxUse` in `/etc/systemd/journald.conf`
- Monitoring ideas:
  - systemd state/restart count: `systemctl show -p ActiveState,RestartCount sogecon-web`
  - External health probe for `/` endpoint (expect 200)

### GitHub Actions deploy (recommended)
- Workflow: `.github/workflows/web-standalone-deploy.yml`
- Trigger: GitHub → Actions → `web-standalone-deploy` → Run workflow (environment=`prod`)
- GitHub Environment `prod` must define
  - Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY` (PEM), optional `SSH_PORT`
  - Variables: `NEXT_PUBLIC_SITE_URL` (for health check)
- Server prerequisites: one‑time setup above and a repo clone at `/srv/sogecon-app`.

### Path policy (/opt vs in‑repo)
- Default (recommended): deploy releases to `/opt/sogecon/web`, operate via `/opt/sogecon/web/current` symlink
  - Pros: clean separation from repo tree, safer rollouts/rollbacks, simpler permissions
  - Cons: one‑time path/permissions setup, backup/monitoring split
- Alternative (in repo): `RELEASE_BASE=/srv/sogecon-app/.releases/web`
  - How‑to: pass `RELEASE_BASE` to `ops/web-deploy.sh` and update `WorkingDirectory` in `ops/systemd/sogecon-web.service` accordingly

## 6) Troubleshooting
- Next public envs not applied: `NEXT_PUBLIC_*` are build‑time only — rebuild required.
- Uploads permission error: ensure `/var/lib/segecon/uploads` owner uid 1000.
- Health check fails: verify Nginx upstream to 127.0.0.1:3000/3001 and TLS cert paths.

## References
- Detailed deploy docs: `ops/deploy_api.md`, `ops/deploy_web.md`
- Nginx examples: `ops/nginx-examples/`
- CI workflows: `.github/workflows/build-push.yml`, `.github/workflows/deploy.yml`
- SSOT (quality/ops rules): `docs/agents_base.md`, `docs/agents_base_kr.md`
