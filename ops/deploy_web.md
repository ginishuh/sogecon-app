# 웹 배포 절차 (초안)

## 1. 목적
- Next.js 웹 애플리케이션을 Vercel/Fly/자체 호스팅 등 Node 24.x 환경에 배포할 때 필요한 준비·검증·롤백 절차를 정리한다.
- 릴리스는 항상 `apps/web` 기준 `pnpm` 워크스페이스에서 수행하며, 배포 전후 로그는 해당 일자의 `docs/dev_log_YYMMDD.md`에 기록한다.

Operator-confirmed current state is a standalone `sogecon-web` systemd release
with Docker API/PostgreSQL until cutover. The accepted near-term target is full
Docker Web using the existing D6 `ops/cloud-start.sh` guards. The standalone
release remains available as the Web rollback fallback, and `compose.yaml` is
local dev/test only.

## 2. 사전 준비
- **필수 환경 변수**
  - `NEXT_PUBLIC_WEB_API_BASE`: API 베이스 URL (예: `https://api.sogangeconomics.com`)
  - `NEXT_PUBLIC_SITE_URL`: 공개 사이트 도메인 (예: `https://sogangeconomics.com`)
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: 웹 푸시 공개키 (필요 시 빈 문자열 허용)
  - `NEXT_PUBLIC_ANALYTICS_ID`: 분석 도구 ID (없으면 unset)
  - `NEXT_PUBLIC_ENABLE_SW`: 서비스 워커 사용 여부 (`1` 또는 unset)
  - (배포 환경이 CSP 완화가 필요할 경우) `NEXT_PUBLIC_RELAX_CSP=1`
  - `API_INTERNAL_URL`: full-Docker target에서 Web server fetch에 필요한 Docker 내부 API URL(standalone fallback에서는 불필요; 브라우저에 노출하지 않음)
- **Node 런타임**: `node 24.12.0`, `pnpm 10.x (>=10.17.1 <11)` (CI는 범위 검사).
- **CI 시크릿**: 위 환경 변수는 CI/CD 공급자의 시크릿 저장소에 사전 등록한다.

> 참고 1: `NEXT_PUBLIC_*` 값은 "빌드타임"에 고정됩니다. `WEB_ENV_FILE`로 런타임에 넣어도 값이 바뀌지 않습니다. 도메인을 교체할 때는 반드시 재빌드가 필요합니다.
> 참고 1-1: production Web build는 HTTPS public API URL이 필수입니다. `WEB_BUILD_ALLOW_INSECURE_LOCAL_API=1`은 loopback HTTP를 쓰는 직접 local/test build에만 사용하며, 일반 `ops/cloud-build.sh`에는 전달하지 않습니다.
> 
> 참고 2(맥/ARM 환경): 로컬/CI가 ARM이고 서버가 AMD64라면 `PLATFORMS=linux/amd64 USE_BUILDX=1`를 함께 지정해 빌드하세요.

## 3. 로컬 검증 (필수)
1. 의존성 설치: `pnpm install`
2. 빌드 확인: `NEXT_PUBLIC_WEB_API_BASE=https://api.example.com pnpm -C apps/web build`
3. 런타임 확인: `pnpm -C apps/web start`
   - 다른 터미널에서 `curl -I http://localhost:3000/` 로 200 응답 확인
   - 검증 완료 후 `Ctrl+C` 로 종료
4. 로컬 production artifact가 loopback API를 의도적으로 사용할 때만 `NEXT_PUBLIC_WEB_API_BASE=http://127.0.0.1:3001 WEB_BUILD_ALLOW_INSECURE_LOCAL_API=1 pnpm -C apps/web build`를 사용한다. `next dev`에는 escape hatch가 필요 없다.

## 4. Target full-Docker 배포 절차
1. `main` 반영 후 `NEXT_PUBLIC_WEB_API_BASE=https://api.example.com pnpm -C apps/web install` 및 `NEXT_PUBLIC_WEB_API_BASE=https://api.example.com pnpm -C apps/web build`를 실행한다.
2. `NEXT_PUBLIC_WEB_API_BASE=https://api.example.com`을 build arg로 사용해 Web image를 build하거나 정확한 release-tagged Web image를 pull한다.
3. API/Web env file과 Docker network를 준비하고 Web env file에
   `API_INTERNAL_URL=http://alumni-api:3001`을 runtime 값으로 설정한다.
4. `docker image inspect`, env-file 존재 확인, `docker network inspect`를 먼저 실행한다.
5. preflight가 통과한 cutover 시점에만 `sudo systemctl stop sogecon-web && sudo systemctl disable sogecon-web`을 실행한다.
6. `API_IMAGE=... WEB_IMAGE=... API_ENV_FILE=... WEB_ENV_FILE=... DOCKER_NETWORK=sogecon_net ./ops/cloud-start.sh`로 full-container를 기동한다. Web 컨테이너가 읽는 `API_INTERNAL_URL`은 3단계에서 준비한 `WEB_ENV_FILE`에 둔다.
7. API/Web health endpoint와 representative browser flow를 확인한다. 이 PR에서는 production migration/readback을 실행하지 않는다.

### 4.1 Full-Docker image command

```bash
IMAGE_PREFIX=local/sogecon \
NEXT_PUBLIC_WEB_API_BASE=https://api.example.com \
NEXT_PUBLIC_SITE_URL=https://www.example.com \
PUSH_IMAGES=0 ./ops/cloud-build.sh
API_IMAGE=local/sogecon/alumni-api:<태그> WEB_IMAGE=local/sogecon/alumni-web:<태그> \
  API_ENV_FILE=/etc/secrets/api.env WEB_ENV_FILE=/etc/secrets/web.env \
  ./ops/cloud-start.sh
```

> 참고: `WEB_ENV_FILE`에는 `API_INTERNAL_URL`과 런타임에 필요한 추가 값(예: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)을 주입한다. `NEXT_PUBLIC_*` public API 값은 build-time이다. Nginx는 127.0.0.1:${WEB_PORT}로 프록시하며, HTTPS/TLS는 기존 서버 설정을 활용한다.

### 4.2 Current standalone / rollback fallback

cutover 전 operator-confirmed 상태를 보존하거나 rollback할 때는
`NEXT_PUBLIC_WEB_API_BASE=https://api.example.com pnpm -C apps/web build` →
`ops/web-deploy.sh` → `/srv/www/sogecon/current` symlink 및
`systemctl is-active --quiet sogecon-web` 흐름을 사용한다. 이 경로는 full-Docker
target의 rollback fallback이며 target primary가 아니다.

## 5. 헬스체크
- 기본 확인 경로: `GET /` (홈) 또는 SSR 페이지 응답 시간 측정
- Lighthouse (선택)로 Perf ≥ 0.90, A11y ≥ 0.90 유지 여부 점검
- 에러 로깅/모니터링 도구에 신규 릴리스 태깅

## 6. 롤백 전략
- D6+ HEALTHCHECK가 포함된 최신 성공 API/Web 이미지 태그는 현재 D6+
  `ops/cloud-start.sh`로 다시 실행한다. 이미지와 스크립트는 matched release
  set이어야 하며, pre-D6 HEALTHCHECK 없는 이미지로 롤백할 때는 해당 pre-D6
  deployment script/release checkout을 함께 사용한다. 같은 preflight와 두
  이미지 health wait가 끝난 성공 메시지가 rollback 완료의 권위 있는 증거다.
- 배포 실패 시:
  1. `cloud-start.sh`가 출력한 제한된 inspect state/recent logs를 확인한다.
  2. 자동 DB rollback이나 조용한 기존 컨테이너 복구를 수행하지 않는다.
  3. D6+ 이전 태그는 현재 D6+ script로, pre-D6 태그는 해당 pre-D6 release
     script로 정확히 다시 실행한다.

Web rollback은 Web container를 stop/rm하고 `ops/web-rollback.sh`로 이전
standalone release symlink를 복구한 뒤 `systemctl enable --now sogecon-web`로
systemd fallback을 재활성화한다.

## 7. 추후 보강 항목
- 배포 대상별 구체 명령 (Vercel CLI, Flyctl 등) 템플릿화
- Lighthouse 예산 자동 검증 (CI 연동) — `ci/web` 작업과 연계

## 8. 도메인 예시(예: sogangeconomics.com) 빌드 예시
```
IMAGE_PREFIX=local/sogecon \
NEXT_PUBLIC_SITE_URL=https://sogangeconomics.com \
NEXT_PUBLIC_WEB_API_BASE=https://api.sogangeconomics.com \
PLATFORMS=linux/amd64 \# 서버가 x86_64면 권장 (ARM 로컬에서 빌드시)
USE_BUILDX=1 \        # buildx 사용
PUSH_IMAGES=0 \
./ops/cloud-build.sh
```

위 명령은 target Docker Web image build 예시다. current-state 보존이나
rollback fallback은 `NEXT_PUBLIC_WEB_API_BASE`를 지정한 standalone build와
`ops/web-deploy.sh`를 사용한다. 레포 루트의 `.env.web.example`은 필요한
`NEXT_PUBLIC_*` 키를 정리할 때 참고한다.
