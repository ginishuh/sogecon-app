# 웹 배포 절차 (초안)

## 1. 목적
- Next.js 웹 애플리케이션을 Vercel/Fly/자체 호스팅 등 Node 24.x 환경에 배포할 때 필요한 준비·검증·롤백 절차를 정리한다.
- 릴리스는 항상 `apps/web` 기준 `pnpm` 워크스페이스에서 수행하며, 배포 전후 로그는 해당 일자의 `docs/dev_log_YYMMDD.md`에 기록한다.

## 2. 사전 준비
- **필수 환경 변수**
  - `NEXT_PUBLIC_WEB_API_BASE`: API 베이스 URL (예: `https://api.sogangeconomics.com`)
  - `NEXT_PUBLIC_SITE_URL`: 공개 사이트 도메인 (예: `https://sogangeconomics.com`)
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: 웹 푸시 공개키 (필요 시 빈 문자열 허용)
  - `NEXT_PUBLIC_ANALYTICS_ID`: 분석 도구 ID (없으면 unset)
  - `NEXT_PUBLIC_ENABLE_SW`: 서비스 워커 사용 여부 (`1` 또는 unset)
  - (배포 환경이 CSP 완화가 필요할 경우) `NEXT_PUBLIC_RELAX_CSP=1`
  - `API_INTERNAL_URL`: Next 서버 전용 Docker 내부 API URL(선택; 브라우저에 노출하지 않음)
- **Node 런타임**: `node 24.12.0`, `pnpm 10.x (>=10.17.1 <11)` (CI는 범위 검사).
- **CI 시크릿**: 위 환경 변수는 CI/CD 공급자의 시크릿 저장소에 사전 등록한다.

> 참고 1: `NEXT_PUBLIC_*` 값은 "빌드타임"에 고정됩니다. `WEB_ENV_FILE`로 런타임에 넣어도 값이 바뀌지 않습니다. 도메인을 교체할 때는 반드시 재빌드가 필요합니다.
> 참고 1-1: production Web build는 HTTPS public API URL이 필수입니다. `WEB_BUILD_ALLOW_INSECURE_LOCAL_API=1`은 loopback HTTP를 쓰는 직접 local/test build에만 사용하며, 일반 `ops/cloud-build.sh`에는 전달하지 않습니다.
> 
> 참고 2(맥/ARM 환경): 로컬/CI가 ARM이고 서버가 AMD64라면 `PLATFORMS=linux/amd64 USE_BUILDX=1`를 함께 지정해 빌드하세요.

## 3. 로컬 검증 (필수)
1. 의존성 설치: `pnpm install`
2. 빌드 확인: `pnpm -C apps/web build`
3. 런타임 확인: `pnpm -C apps/web start`
   - 다른 터미널에서 `curl -I http://localhost:3000/` 로 200 응답 확인
   - 검증 완료 후 `Ctrl+C` 로 종료
4. 로컬 production artifact가 loopback API를 의도적으로 사용할 때만 `NEXT_PUBLIC_WEB_API_BASE=http://127.0.0.1:3001 WEB_BUILD_ALLOW_INSECURE_LOCAL_API=1 pnpm -C apps/web build`를 사용한다. `next dev`에는 escape hatch가 필요 없다.

## 4. 배포 절차 (예시: 수동/온박스)
1. `main` 반영 후 로컬 또는 VPS에서 `pnpm -C apps/web build` 성공 여부 확인
2. 이미지 빌드: `IMAGE_PREFIX=local/sogecon NEXT_PUBLIC_WEB_API_BASE=https://api... NEXT_PUBLIC_SITE_URL=https://alumni... PUSH_IMAGES=0 ./ops/cloud-build.sh`
3. 런타임 재시작: `API_IMAGE=local/sogecon/alumni-api:<태그> WEB_IMAGE=local/sogecon/alumni-web:<태그> API_ENV_FILE=/etc/secrets/api.env WEB_ENV_FILE=/etc/secrets/web.env ./ops/cloud-start.sh`
4. `cloud-start.sh`가 API healthy 후 Web healthy까지 확인하므로 성공 메시지를 받은 뒤 `/` 또는 주요 페이지를 추가 확인한다.
5. CDN/리버스 프록시 캐시 무효화 (필요 시)

> 참고: `WEB_ENV_FILE`에는 `API_INTERNAL_URL`과 런타임에 필요한 추가 값(예: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)을 주입한다. `NEXT_PUBLIC_*` public API 값은 build-time이다. Nginx는 127.0.0.1:${WEB_PORT}로 프록시하며, HTTPS/TLS는 기존 서버 설정을 활용한다.

## 5. 헬스체크
- 기본 확인 경로: `GET /` (홈) 또는 SSR 페이지 응답 시간 측정
- Lighthouse (선택)로 Perf ≥ 0.90, A11y ≥ 0.90 유지 여부 점검
- 에러 로깅/모니터링 도구에 신규 릴리스 태깅

## 6. 롤백 전략
- 최신 성공 배포의 API/Web 이미지 태그를 정확히 지정해 `ops/cloud-start.sh`를 다시 실행한다. 같은 preflight와 두 이미지 health wait가 끝난 성공 메시지가 rollback 완료의 권위 있는 증거다.
- 배포 실패 시:
  1. `cloud-start.sh`가 출력한 제한된 inspect state/recent logs를 확인한다.
  2. 자동 DB rollback이나 조용한 기존 컨테이너 복구를 수행하지 않는다.
  3. 이전 태그를 정확히 넣어 같은 script를 다시 실행한다.

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

> 참고: 레포 루트의 `.env.web.example`을 참고해 필요한 `NEXT_PUBLIC_*` 키를 정리하세요.
