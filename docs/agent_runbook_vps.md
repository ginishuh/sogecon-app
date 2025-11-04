# VPS Agent Runbook (서버 운영자/에이전트용)

> English version: `docs/agent_runbook_vps_en.md`

본 문서는 VPS에 레포를 클론한 뒤 에이전트(Codex CLI/Claude)가 안전하게 배포/재배포 작업을 수행할 수 있도록 표준 절차를 제공합니다. 컨테이너 이미지는 GHCR 기준입니다.

## 요구 사항
- Docker 설치 및 `docker login ghcr.io` 권한(PAT 또는 GitHub Actions에서 전달)
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
cd /srv/sogecon-app
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

## 5) 웹 비컨테이너(Next.js standalone + systemd + Nginx)

컨테이너 대신 Next.js `standalone` 산출물을 systemd 서비스로 구동합니다. DB/API는 기존 컨테이너 구성을 유지합니다.

사전 준비(1회)
- Node 고정 설치: `asdf plugin add nodejs && asdf install nodejs 22.17.1 && asdf global nodejs 22.17.1`
- systemd 유닛 배치: `sudo cp ops/systemd/sogecon-web.service /etc/systemd/system/ && sudo systemctl enable sogecon-web`
- Nginx 프록시: `ops/nginx/nginx-site-web.conf` 참고(도메인/인증서 경로 수정 후 적용)
- 릴리스 경로 생성: `sudo mkdir -p /opt/sogecon/web/releases && sudo chown $USER /opt/sogecon/web -R`

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
1. 레포 루트에서 웹 빌드: `pnpm -C apps/web install && pnpm -C apps/web build`
2. 산출물 전개/링크 전환: `bash ops/web-deploy.sh` (환경변수: `RELEASE_BASE`, `SERVICE_NAME` 커스터마이즈 가능)
3. 상태 확인: `systemctl status sogecon-web` (active), `curl -i http://127.0.0.1:3000/` (200)

롤백 절차
- 직전 릴리스로 링크 전환 및 재시작: `bash ops/web-rollback.sh`

디렉터리 구조(예시)
```
/opt/sogecon/web/
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
  - `find /opt/sogecon/web/releases -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +`
- 로그 확인/로테이션:
  - 앱: `journalctl -u sogecon-web -f`
  - Nginx: `/var/log/nginx/access.log`, `/var/log/nginx/error.log` (logrotate 기본 적용)
  - journal 용량 제한: `/etc/systemd/journald.conf`의 `SystemMaxUse` 등 조정
- 모니터링 초안:
  - systemd 상태/재시작 횟수: `systemctl show -p ActiveState,RestartCount sogecon-web`
  - 헬스엔드포인트를 크론/외부 모니터로 주기 확인(200 응답)

### GitHub Actions 배포(권장)
- 워크플로: `.github/workflows/web-standalone-deploy.yml`
- 트리거: GitHub → Actions → `web-standalone-deploy` → Run workflow (environment=`prod`)
- GitHub Environment `prod`에 필요한 값
  - Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`(PEM), `SSH_PORT`(옵션)
  - Variables: `NEXT_PUBLIC_SITE_URL` (헬스체크에 사용)
- 서버 선행 준비: 위 사전 준비(1회)와 `/srv/sogecon-app` 레포 클론 필요.

### 경로 정책(/opt vs 레포 내부)
- 기본(권장): `/opt/sogecon/web`에 릴리스 전개, `/opt/sogecon/web/current` 심볼릭 링크 운용
  - 장점: 운영/롤백이 레포 작업트리와 분리되어 안전, 권한 관리 용이
  - 단점: 초기 경로/권한 준비 필요, 백업/모니터링 경로가 분리됨
- 대안(레포 내부): `RELEASE_BASE=/srv/sogecon-app/.releases/web`
  - 사용 시 조치: `ops/web-deploy.sh` 실행 시 `RELEASE_BASE` 환경변수 지정, `ops/systemd/sogecon-web.service`의 `WorkingDirectory`를 동일 경로로 변경

## 6) 트러블슈팅
- 웹 공개변수 반영 안 됨: Next `NEXT_PUBLIC_*`는 빌드타임 고정 — 반드시 재빌드 필요
- 업로드 권한 오류: `/var/lib/segecon/uploads` 소유자/권한 확인(UID 1000)
- 헬스체크 실패: Nginx 프록시 대상(127.0.0.1:3000/3001)·TLS 인증서 경로 확인

## 참고 문서
- 배포 절차(상세): `ops/deploy_api.md`, `ops/deploy_web.md`
- Nginx 예시: `ops/nginx-examples/`
- CI 워크플로: `.github/workflows/build-push.yml`, `.github/workflows/deploy.yml`
- SSOT(운영/품질 규칙): `docs/agents_base.md`, `docs/agents_base_kr.md`
