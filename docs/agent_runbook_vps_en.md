# VPS Agent Runbook (for Docker + Nginx servers)

This runbook helps an on‑box agent (Codex CLI/Claude) deploy and redeploy the app on a VPS using container images (GHCR).

## Requirements
- Docker installed; ability to `docker login ghcr.io` (via PAT or injected token)
- Reverse proxy (Nginx/Caddy) forwarding 443 → 127.0.0.1:3000 (Web) and 127.0.0.1:3001 (API)
- Repo path on server: `/srv/segecon` (recommended)

## 1) One‑time setup
```bash
sudo mkdir -p /srv/segecon && sudo chown $USER /srv/segecon
git clone https://github.com/ginishuh/sogecon-app.git /srv/segecon
cd /srv/segecon

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
- Variables: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WEB_API_BASE`, and other `NEXT_PUBLIC_*` as needed. (Recommended) `DOCKER_NETWORK` (e.g., `segecon_net`).
- Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, optional `SSH_PORT`, `GHCR_PAT` (read:packages)

## 3) Deploy path B — manual on the server
```bash
cd /srv/segecon
PREFIX=ghcr.io/<owner>/<repo>
TAG=<commit-sha-or-release>

# 1) Pull images
docker pull $PREFIX/alumni-api:$TAG
docker pull $PREFIX/alumni-web:$TAG

# 2) DB migration (when schema changed)
docker network inspect segecon_net >/dev/null 2>&1 || docker network create segecon_net
API_IMAGE=$PREFIX/alumni-api:$TAG ENV_FILE=.env.api DOCKER_NETWORK=segecon_net \
  bash ./ops/cloud-migrate.sh

# 3) Restart services
API_IMAGE=$PREFIX/alumni-api:$TAG \
WEB_IMAGE=$PREFIX/alumni-web:$TAG \
API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
DOCKER_NETWORK=segecon_net \
  bash ./ops/cloud-start.sh

# 4) Health checks
curl -fsS https://api.<domain>/healthz -o /dev/null
curl -fsS https://<domain>/ -o /dev/null
```

## 4) Cookie/domain switches
- Subdomain stage: `COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true`.
- Cross‑site domains: `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (HTTPS required).
- Location: `.env.api` → applied by `SessionMiddleware` in `apps/api/main.py`.

## 5) Troubleshooting
- Next public envs not applied: `NEXT_PUBLIC_*` are build‑time only — rebuild required.
- Uploads permission error: ensure `/var/lib/segecon/uploads` owner uid 1000.
- Health check fails: verify Nginx upstream to 127.0.0.1:3000/3001 and TLS cert paths.

## References
- Detailed deploy docs: `ops/deploy_api.md`, `ops/deploy_web.md`
- Nginx examples: `ops/nginx-examples/`
- CI workflows: `.github/workflows/build-push.yml`, `.github/workflows/deploy.yml`
- SSOT (quality/ops rules): `docs/agents_base.md`, `docs/agents_base_kr.md`
