# 웹 배포 절차 (초안)

## 1. 목적
- Next.js 웹 애플리케이션을 Vercel/Fly/자체 호스팅 등 Node 22.x 환경에 배포할 때 필요한 준비·검증·롤백 절차를 정리한다.
- 릴리스는 항상 `apps/web` 기준 `pnpm` 워크스페이스에서 수행하며, 배포 전후 로그를 `docs/worklog.md`에 기록한다.

## 2. 사전 준비
- **필수 환경 변수**
  - `NEXT_PUBLIC_WEB_API_BASE`: API 베이스 URL (예: `https://api.alumni.sogang-econ.kr`)
  - `NEXT_PUBLIC_SITE_URL`: 공개 사이트 도메인 (예: `https://alumni.sogang-econ.kr`)
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: 웹 푸시 공개키 (필요 시 빈 문자열 허용)
  - `NEXT_PUBLIC_ANALYTICS_ID`: 분석 도구 ID (없으면 unset)
  - `NEXT_PUBLIC_ENABLE_SW`: 서비스 워커 사용 여부 (`1` 또는 unset)
  - (배포 환경이 CSP 완화가 필요할 경우) `NEXT_PUBLIC_RELAX_CSP=1`
- **Node 런타임**: `node 22.17.1`, `pnpm 10.17.1` (CI에서도 동일 버전 고정).
- **CI 시크릿**: 위 환경 변수는 CI/CD 공급자의 시크릿 저장소에 사전 등록한다.

## 3. 로컬 검증 (필수)
1. 의존성 설치: `pnpm install`
2. 빌드 확인: `pnpm -C apps/web build`
3. 런타임 확인: `pnpm -C apps/web start`
   - 다른 터미널에서 `curl -I http://localhost:3000/` 로 200 응답 확인
   - 검증 완료 후 `Ctrl+C` 로 종료
4. 프리뷰에서 CSP 완화가 필요한 경우 `.env.local` 에 `NEXT_PUBLIC_RELAX_CSP=1` 설정 후 HMR 동작 확인

## 4. 배포 절차 (예시: CI/CD)
1. `main` 브랜치 병합 → CI `pnpm -C apps/web build` 성공 여부 확인
2. 이미지 빌드: `IMAGE_PREFIX=registry/alumni NEXT_PUBLIC_WEB_API_BASE=https://api... NEXT_PUBLIC_SITE_URL=https://alumni... PUSH_IMAGES=1 ./ops/cloud-build.sh`
3. 런타임 재시작: `API_IMAGE=registry/alumni-api:<태그> WEB_IMAGE=registry/alumni-web:<태그> WEB_ENV_FILE=/etc/secrets/web.env ./ops/cloud-start.sh`
4. `/` 또는 주요 페이지에 대한 헬스체크 수행
5. CDN/리버스 프록시 캐시 무효화 (필요 시)

> 참고: `WEB_ENV_FILE`에는 런타임에 필요한 `NEXT_PUBLIC_*` 값과 추가 시크릿(예: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)을 주입한다. Nginx는 127.0.0.1:${WEB_PORT}로 프록시하며, HTTPS/TLS는 기존 서버 설정을 활용한다.

## 5. 헬스체크
- 기본 확인 경로: `GET /` (홈) 또는 SSR 페이지 응답 시간 측정
- Lighthouse (선택)로 Perf ≥ 0.90, A11y ≥ 0.90 유지 여부 점검
- 에러 로깅/모니터링 도구에 신규 릴리스 태깅

## 6. 롤백 전략
- 최신 성공 배포 태그/버전을 `ops/rollback.md` 절차에 따라 복구
- 배포 실패 시:
  1. 트래픽을 이전 버전 인스턴스로 즉시 전환 (blue/green 또는 previous deployment)
  2. 실패 원인 로그 수집 (`pnpm -C apps/web build` 실패 로그, 런타임 에러 스택)
  3. `docs/worklog.md` 에 실패 기록 & 재배포 일정 공유

## 7. 추후 보강 항목
- 배포 대상별 구체 명령 (Vercel CLI, Flyctl 등) 템플릿화
- Lighthouse 예산 자동 검증 (CI 연동) — `ci/web` 작업과 연계
