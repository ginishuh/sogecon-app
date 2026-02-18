# API 배포 절차 (초안)

## 1. 목적
- FastAPI 백엔드(`apps/api`)를 프로덕션 환경에 안전하게 배포하고, 실패 시 빠르게 롤백하기 위한 표준 운영 문서를 정의한다.
- 데이터베이스는 PostgreSQL 16만 지원한다(루트 `compose.yaml`). 모든 환경에서 `postgresql+psycopg://` 스킴을 사용한다.

## 2. 필수 환경 변수
- `APP_ENV`: `dev` / `staging` / `prod`
- `DATABASE_URL`: SQLAlchemy 접속 문자열 (예: `postgresql+psycopg://user:pass@host:5432/db`)
- `JWT_SECRET`: 세션/토큰 서명 키
- `CORS_ORIGINS`: 허용 Origin 목록(JSON 문자열). 예: `[{"origin": "https://sogangeconomics.com"}]`가 아니라 `['https://sogangeconomics.com']` 형태로 보일 수 있으니, 실제 설정은 다음과 같이 JSON 배열 문자열을 권장: `CORS_ORIGINS=["https://sogangeconomics.com"]`
- `RATE_LIMIT_DEFAULT`: 기본 레이트리밋 (예: `120/minute`)
- `RATE_LIMIT_POST_CREATE`: 멤버 게시글 작성 레이트리밋 (예: `5/minute`)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `PUSH_ENCRYPT_AT_REST`, `PUSH_KEK`: 푸시 구독 암호화 옵션
- (선택) 관리자 bootstrap 시드: `SEED_PROD_ADMIN001_VALUE`
- `MEDIA_ROOT`, `MEDIA_URL_BASE`: 업로드 경로 (기본값 사용 가능)
- Sentry/관측: `SENTRY_DSN`, `RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`(기본 0.05), `SENTRY_PROFILES_SAMPLE_RATE`(기본 0.0), `SENTRY_SEND_DEFAULT_PII`(필요 시 `true`)
- CI/CD 시크릿 스토리지에 위 값을 저장하고 배포 시 주입한다.

### 쿠키/세션(도메인 전략에 따른 권장값)
- 기본(같은 상위도메인의 하위 도메인, 예: `sogangeconomics.com` + `api.sogangeconomics.com`):
  - `COOKIE_SAMESITE=lax`(기본값) — 같은 사이트(eTLD+1) 간 요청은 쿠키 포함
  - `COOKIE_SECURE=true`(권장; `APP_ENV=prod`면 자동 true)
- 별도 상위 도메인으로 전환 후(교차 사이트):
  - `COOKIE_SAMESITE=none` (반드시 HTTPS 필요)
  - `COOKIE_SECURE=true`
  - 필요 시 `COOKIE_DOMAIN=<api.example.com>` 지정(기본은 호스트 전용)

## 3. 로컬 검증
1. 가상환경 준비: `make venv && make api-install`
2. 정적 분석: `.venv/bin/python -m pyright` / `.venv/bin/ruff check apps/api`
3. 테스트: `.venv/bin/pytest -q`
4. 런타임 확인: `.venv/bin/uvicorn apps.api.main:app --host 0.0.0.0 --port 3001`
5. 다른 터미널에서 헬스 체크: `curl -I http://localhost:3001/healthz` → `200 OK`
6. 종료 후 해당 일자의 `docs/dev_log_YYMMDD.md`에 검증 결과 기록

## 4. 배포 절차 (예시)
1. `main` 병합 → CI에서 `pytest`, `pyright`, `ruff` 성공 확인
2. 컨테이너 이미지 빌드: `IMAGE_PREFIX=registry/alumni PUSH_IMAGES=1 ./ops/cloud-build.sh`
   - (로컬/CI가 ARM이고 서버가 AMD64면) `PLATFORMS=linux/amd64 USE_BUILDX=1`를 함께 지정
3. DB 마이그레이션 적용: `API_IMAGE=registry/alumni-api:<태그> ENV_FILE=/etc/secrets/api.env ./ops/cloud-migrate.sh`
4. (선택) 관리자 bootstrap 시드: `API_IMAGE=registry/alumni-api:<태그> ENV_FILE=/etc/secrets/api.env ./ops/cloud-seed-admin.sh`
5. 서비스 재시작: `API_IMAGE=... WEB_IMAGE=registry/alumni-web:<태그> API_ENV_FILE=/etc/secrets/api.env WEB_ENV_FILE=/etc/secrets/web.env ./ops/cloud-start.sh`
6. 프로빙: `curl https://api.sogangeconomics.com/healthz` 응답 확인, 주요 엔드포인트 스팟 체크

> 참고: `API_ENV_FILE`에는 `DATABASE_URL`, `JWT_SECRET`, `PUSH_*`, `SENTRY_*` 등 필수 시크릿을 포함한다. 컨테이너 업로드 볼륨은 `UPLOADS_DIR=/var/lib/sogecon/uploads` 로 기본 설정되어 있으며, 필요 시 커스터마이즈한다.
> 관리자 bootstrap 시드를 실행할 경우 `SEED_PROD_ADMIN001_VALUE`를 `.env.api`에 설정해야 한다.

## 5. 모니터링 & 알림
- 구조화 로그(JSON Lines) 수집 시스템에 배포 버전 태그
- SlowAPI 레이트리밋 초과 로그 모니터링
- 향후 `/__health` 라우트 추가 시, DB/외부 의존성 체크 포함 예정 (후속 작업)

## 6. 롤백 전략
- `ops/rollback.md` 문서를 참조하여 이전 이미지/커밋으로 즉시 배포 전환
- DB 마이그레이션 롤백이 필요한 경우 `alembic downgrade <revision>` 실행 (사전 백업 필수)
- 실패 원인: `journalctl -u alumni-api`, 애플리케이션 로그, Sentry 등으로 분석

## 7. 체크리스트
- [ ] 환경 변수/시크릿 최신 상태 확인
- [ ] CI 결과 및 테스트 패스
- [ ] 헬스 체크 200 응답
- [ ] 모니터링 알람 미발생
- [ ] 롤백 계획/백업 확인

## 8. 도메인 예시(예: sogangeconomics.com) 퀵스타트
1) DNS: `sogangeconomics.com`, `www.sogangeconomics.com`, `api.sogangeconomics.com` → VPS IP
2) API `.env` 혹은 env-file
   - 레포 루트의 `.env.api.example`을 복사해 `.env.api` 생성 후 값 채움
   - 최소 구성: `APP_ENV=prod`, `CORS_ORIGINS=["https://sogangeconomics.com","https://www.sogangeconomics.com"]`, `JWT_SECRET=...`, `DATABASE_URL=...`
   - 쿠키: `COOKIE_SAMESITE=lax`(기본), `COOKIE_SECURE=true`
3) 마이그레이션/기동
   - `API_IMAGE=... ENV_FILE=.env.api ./ops/cloud-migrate.sh`
   - `API_IMAGE=... WEB_IMAGE=... API_ENV_FILE=.env.api WEB_ENV_FILE=.env.web ./ops/cloud-start.sh`
4) 프록시: `api.sogangeconomics.com` → `127.0.0.1:3001`(예시 Nginx는 `ops/nginx-examples/` 참고)
5) 헬스체크: `GET https://api.sogangeconomics.com/healthz` → 200

> 추후 별도 도메인(예: `sogecon.app` 등)으로 전환 시:
> - `CORS_ORIGINS`에 새 웹 도메인 추가
> - `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`
> - 웹 빌드는 `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WEB_API_BASE`를 새 도메인으로 재빌드
