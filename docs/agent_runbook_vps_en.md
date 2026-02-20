# VPS Agent Runbook (for Docker + Nginx servers)

This runbook helps an on‑box agent (Codex CLI/Claude) deploy and redeploy the app on a VPS. The default path builds images directly on the VPS.

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

## 2) Deploy path A — on-box local build (recommended)
Checklist (quick)
- [ ] Dedicated network exists (`sogecon_net`)
- [ ] `.env.api` uses container DNS in `DATABASE_URL` (e.g., `sogecon-db`)
- [ ] Local build → migrate → restart order
- [ ] Health 200 (allow warm‑up ≤90s)
```bash
cd /srv/sogecon-app
TAG=<commit-sha-or-release>

bash ./scripts/deploy-vps.sh -t "$TAG" --local-build \
  --network sogecon_net \
  --api-health https://api.<domain>/healthz \
  --web-health https://<domain>/
```

## 3) Deploy path B — pull from external registry (optional)
Use this path only when you explicitly need a registry.
```bash
cd /srv/sogecon-app
PREFIX=<registry>/<namespace>/<repo>
TAG=<commit-sha-or-release>

bash ./scripts/deploy-vps.sh -t "$TAG" -p "$PREFIX" --pull-images \
  --network sogecon_net \
  --api-health https://api.<domain>/healthz \
  --web-health https://<domain>/

# Emergency rollback
PREV=<stable-tag>
bash ./scripts/deploy-vps.sh -t "$PREV" -p "$PREFIX" --pull-images \
  --network sogecon_net \
  --skip-migrate
```

## 4) Cookie/domain switches
- Subdomain stage: `COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true`.
- Cross‑site domains: `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (HTTPS required).
- Location: `.env.api` → applied by `SessionMiddleware` in `apps/api/main.py`.

## 5) Web without container (Next.js standalone + systemd + Nginx)

Run the Next.js `standalone` build as a systemd service. DB/API containers remain unchanged.

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
1) Build at repo root: `pnpm -C apps/web install && pnpm -C apps/web build`
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

## 6) Troubleshooting
- Next public envs not applied: `NEXT_PUBLIC_*` are build‑time only — rebuild required.
- Uploads permission error: ensure `/var/lib/sogecon/uploads` owner uid 1000.
- Health check fails: verify Nginx upstream to 127.0.0.1:3000/3001 and TLS cert paths.

## References
- Detailed deploy docs: `ops/deploy_api.md`, `ops/deploy_web.md`
- Nginx examples: `ops/nginx-examples/`
- CI workflows: `.github/workflows/ci.yml`, `.github/workflows/dto-verify.yml`, `.github/workflows/codeql.yml`
- SSOT (quality/ops rules): `docs/agents_base.md`, `docs/agents_base_kr.md`
