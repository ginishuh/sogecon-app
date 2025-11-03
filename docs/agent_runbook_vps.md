# VPS Agent Runbook (서버 운영자/에이전트용)

> English version: `docs/agent_runbook_vps_en.md`

본 문서는 VPS에 레포를 클론한 뒤 에이전트(Codex CLI/Claude)가 안전하게 배포/재배포 작업을 수행할 수 있도록 표준 절차를 제공합니다. 컨테이너 이미지는 GHCR 기준입니다.

## 요구 사항
- Docker 설치 및 `docker login ghcr.io` 권한(PAT 또는 GitHub Actions에서 전달)
- Nginx/Caddy 등 리버스 프록시(127.0.0.1:3000/3001 프록시)
- 레포 위치: `/srv/segecon` (권장)

## 1) 최초 준비(1회)
```bash
sudo mkdir -p /srv/segecon && sudo chown $USER /srv/segecon
git clone https://github.com/ginishuh/sogecon-app.git /srv/segecon
cd /srv/segecon

# 시크릿 파일 준비(레포 루트)
cp .env.api.example .env.api   # JWT_SECRET/DATABASE_URL/CORS_ORIGINS 등 값 채우기
cp .env.web.example .env.web   # 선택. Next 공개변수는 빌드타임 고정(참고용)

# 업로드 디렉터리(컨테이너 볼륨)
sudo mkdir -p /var/lib/segecon/uploads
sudo chown 1000:1000 /var/lib/segecon/uploads
```

## 2) 배포 경로 A — GitHub Actions(권장)
1. CI가 `build-push` 워크플로로 GHCR에 이미지 푸시
2. 수동으로 `deploy` 워크플로 실행
   - 입력값: `tag`(커밋 SHA 7자리 등), `environment=prod`, `skip_migrate` 여부
   - 워크플로가 VPS에 SSH 접속 후 `pull → migrate → restart → health` 순서로 실행

필요한 GitHub 설정(Environments: `prod`)
- Variables(vars): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WEB_API_BASE`, 필요 시 `NEXT_PUBLIC_*`, (권장) `DOCKER_NETWORK`(예: `sogecon_net`)
- Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, (옵션) `SSH_PORT`, `GHCR_PAT`(read:packages)

## 3) 배포 경로 B — 서버에서 직접 배포(수동)
체크리스트(요약)
- [ ] 전용 네트워크 존재(`sogecon_net`)
- [ ] `.env.api`에 `DATABASE_URL=postgresql+psycopg://…@sogecon-db:5432/…`
- [ ] 이미지 pull → 마이그레이션 → 재기동 순서
- [ ] 헬스체크 200(워밍업 ≤90s 허용)
```bash
cd /srv/segecon
export PREFIX=ghcr.io/<owner>/<repo>
export TAG=<커밋SHA7 또는 릴리스 태그>

# 1) 이미지 풀
docker pull $PREFIX/alumni-api:$TAG
docker pull $PREFIX/alumni-web:$TAG

# 2) DB 마이그레이션(스키마 변경이 있을 때)
docker network inspect sogecon_net >/dev/null 2>&1 || docker network create sogecon_net
API_IMAGE=$PREFIX/alumni-api:$TAG ENV_FILE=.env.api DOCKER_NETWORK=sogecon_net \
  bash ./ops/cloud-migrate.sh

# 3) 서비스 재시작
API_IMAGE=$PREFIX/alumni-api:$TAG \
WEB_IMAGE=$PREFIX/alumni-web:$TAG \
API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
DOCKER_NETWORK=sogecon_net \
  bash ./ops/cloud-start.sh

# 4) 헬스체크
for i in {1..90}; do code=$(curl -sf -o /dev/null -w "%{http_code}" https://api.<도메인>/healthz || true); [ "$code" = 200 ] && break; sleep 1; done
for i in {1..90}; do code=$(curl -sf -o /dev/null -w "%{http_code}" https://<도메인>/ || true); [ "$code" = 200 ] && break; sleep 1; done

## 비상 절차(롤백)
```bash
PREV=<stable-tag>
docker pull $PREFIX/alumni-api:$PREV
docker pull $PREFIX/alumni-web:$PREV
API_IMAGE=$PREFIX/alumni-api:$PREV WEB_IMAGE=$PREFIX/alumni-web:$PREV \
  DOCKER_NETWORK=sogecon_net API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web \
  bash ./ops/cloud-start.sh
```
```

## 4) 쿠키/도메인 전환 스위치
- 서브도메인 단계: `COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true`
- 별도 도메인(교차 사이트): `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (HTTPS 필수)
- 설정 위치: `.env.api` → `apps/api/main.py`의 `SessionMiddleware`에 반영됨

## 5) 트러블슈팅
- 웹 공개변수 반영 안 됨: Next `NEXT_PUBLIC_*`는 빌드타임 고정 — 반드시 재빌드 필요
- 업로드 권한 오류: `/var/lib/segecon/uploads` 소유자/권한 확인(UID 1000)
- 헬스체크 실패: Nginx 프록시 대상(127.0.0.1:3000/3001)·TLS 인증서 경로 확인

## 참고 문서
- 배포 절차(상세): `ops/deploy_api.md`, `ops/deploy_web.md`
- Nginx 예시: `ops/nginx-examples/`
- CI 워크플로: `.github/workflows/build-push.yml`, `.github/workflows/deploy.yml`
- SSOT(운영/품질 규칙): `docs/agents_base.md`, `docs/agents_base_kr.md`
