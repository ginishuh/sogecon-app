# WSL2 로컬 환경 — VPS와 동일 배포 흐름 미러링

본 문서는 WSL2 로컬에서 VPS 프로덕션 배포 흐름(이미지 pull → DB 마이그레이션 → 컨테이너 재기동 → 헬스체크)을 그대로 재현하는 방법을 설명합니다. 운영 시크릿은 절대 커밋하지 말고, 로컬에서는 개발용 값이나 테스트 전용 값만 사용하세요.

## 전제 조건
- Docker Desktop + WSL2 통합 활성화, `docker compose` 사용 가능
- GHCR 접근 토큰: GitHub Personal Access Token(PAT) — 최소 `read:packages`
  - 환경변수: `GHCR_USER=<깃허브 사용자명>`, `GHCR_PAT=<PAT 값>`
- API/Web 런타임 env 파일 준비
  - `cp .env.api.example .env.api` 후 `DATABASE_URL`을 로컬 PG로 맞춤(권장: `postgresql+psycopg://app:devpass@localhost:5433/appdb`)
  - `cp .env.web.example .env.web` (옵션; 공개 `NEXT_PUBLIC_*`는 빌드타임 고정)

## 1) 로컬 PostgreSQL 기동(권장)
```
make db-up   # root compose(dev): dev 5433 + test 5434
```

## 2) GHCR 로그인
```
export GHCR_USER=<github-username>
export GHCR_PAT=<personal-access-token-with-read:packages>
make ghcr-login
```

## 3) 이미지 Pull → 마이그레이션 → 재기동
- CI에서 빌드·푸시된 태그(커밋 SHA 등)를 사용합니다. 예: `e29de67`
```
# 프리픽스는 기본적으로 origin 원격을 기준으로 ghcr.io/<owner>/<repo> 로 추정됩니다.
make deploy-local TAG=e29de67 \
DOCKER_NETWORK=sogecon_net \  # 선택: 로컬 전용 네트워크 사용 시
  API_HEALTH=http://localhost:3001/healthz \  # 선택
  WEB_HEALTH=http://localhost:3000/           # 선택
```

동작 내용:
- `docker pull ghcr.io/<owner>/<repo>/alumni-{api,web}:<TAG>`
- `ops/cloud-migrate.sh`로 Alembic `upgrade head` 실행(`.env.api` 또는 `DATABASE_URL` 사용)
- `ops/cloud-start.sh`로 API/Web 컨테이너 재기동(포트: 127.0.0.1:3001/3000)
- 선택적으로 헬스 체크 수행

## 4) 트러블슈팅
- GHCR 인증 실패: `GHCR_USER/GHCR_PAT` 값 확인. PAT에는 최소 `read:packages` 필요.
- DB 접속 실패: `.env.api`의 `DATABASE_URL`이 로컬 PG(5433) 또는 접근 가능한 인스턴스를 가리키는지 확인.
- 네트워크가 필요한 경우: `DOCKER_NETWORK=<name>`로 통일된 네트워크에 API/Web/DB를 연결하세요.
- 포트 충돌: `API_PORT`/`WEB_PORT` 환경변수로 `ops/cloud-start.sh` 바인딩 포트를 변경할 수 있습니다.

## 5) 주의사항(운영 데이터 보호)
- 로컬에서 운영 DB에 직접 연결하지 마세요. 필요 시 별도 스테이징 인스턴스 또는 덤프/샘플 데이터 사용을 권장합니다.
- `.env*` 파일은 `.dockerignore`에 의해 Docker 빌드 컨텍스트에서 제외됩니다. 예제 템플릿만 커밋 대상입니다.

## 6) 요약 명령어
```
make db-up
make ghcr-login
make deploy-local TAG=<commit-sha>
curl -I http://localhost:3001/healthz
```

## (옵션) Dev 컨테이너 모드 — 핫리로드로 개발
- 목적: 로컬에서도 컨테이너를 띄워놓고(VPS와 동일 네트워킹) 코드 변경을 즉시 반영해 개발합니다.
- 구성: root `compose.yaml` dev 프로필 — `api_dev(uvicorn --reload)` + `web_dev(pnpm dev)`

실행(Compose만 사용):
```
docker compose up -d   # Postgres + api_dev + web_dev 한 번에 기동
```

수동(make 유틸):
```
# VPS 유사 모드(권장): DB(dev/test) + api_dev만
make dev-api-up                 # Postgres(5433) + Postgres(test:5434) + api_dev:3001
make dev-api-logs               # API 로그 팔로우
make dev-api-down               # 세 서비스 중지

# 전체(dev 웹 포함): 필요할 때만
make dev-containers-up          # Postgres + api_dev + web_dev
make dev-containers-logs        # 최근 1분 로그 팔로우
make dev-containers-down        # 종료
```

주의:
- WSL2 파일시스템에서는 변경 감지 이슈가 있어 `WATCHFILES_FORCE_POLLING=1`를 API 컨테이너에 설정했습니다.
- Web 컨테이너는 `node:22-slim`에서 `pnpm`을 corepack으로 준비 후 `pnpm -C apps/web dev`로 기동합니다.

### 권한 이슈 예방(컨테이너 파일 소유권)
- dev 컨테이너가 바인드 마운트에 파일을 쓸 때 root 소유물이 생기지 않도록, 루트 `compose.yaml`의 `web_dev` 서비스는 `user: "${UID:-1000}:${GID:-1000}"`로 실행됩니다. `scripts/compose-dev-up.sh`가 UID/GID를 자동 주입합니다.
- 과거 실행으로 root 소유물이 남아 있으면 다음 스크립트로 복구하세요(호스트 sudo 불필요):
  ```bash
  ./scripts/fix-web-perms.sh
  ```

 
