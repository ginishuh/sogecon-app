# API 배포 절차 (초안)

## 1. 목적
- FastAPI 백엔드(`apps/api`)를 프로덕션 환경에 안전하게 배포하고, 실패 시 빠르게 롤백하기 위한 표준 운영 문서를 정의한다.
- 데이터베이스는 기본 SQLite, 실서비스에서는 PostgreSQL 16 (`infra/docker-compose.dev.yml`) 기준으로 가정한다.

## 2. 필수 환경 변수
- `APP_ENV`: `dev` / `staging` / `prod`
- `DATABASE_URL`: SQLAlchemy 접속 문자열 (예: `postgresql+psycopg://user:pass@host:5432/db`)
- `JWT_SECRET`: 세션/토큰 서명 키
- `CORS_ORIGINS`: 허용 Origin 쉼표 구분 문자열 (예: `https://alumni.sogang-econ.kr`)
- `RATE_LIMIT_DEFAULT`: 기본 레이트리밋 (예: `120/minute`)
- `RATE_LIMIT_POST_CREATE`: 멤버 게시글 작성 레이트리밋 (예: `5/minute`)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `PUSH_ENCRYPT_AT_REST`, `PUSH_KEK`: 푸시 구독 암호화 옵션
- `MEDIA_ROOT`, `MEDIA_URL_BASE`: 업로드 경로 (기본값 사용 가능)
- Sentry/관측: `SENTRY_DSN`, `RELEASE`, `SENTRY_TRACES_SAMPLE_RATE`(기본 0.05), `SENTRY_PROFILES_SAMPLE_RATE`(기본 0.0), `SENTRY_SEND_DEFAULT_PII`(필요 시 `true`)
- CI/CD 시크릿 스토리지에 위 값을 저장하고 배포 시 주입한다.

## 3. 로컬 검증
1. 가상환경 준비: `make venv && make api-install`
2. 정적 분석: `.venv/bin/python -m pyright` / `.venv/bin/ruff check apps/api`
3. 테스트: `.venv/bin/pytest -q`
4. 런타임 확인: `.venv/bin/uvicorn apps.api.main:app --host 0.0.0.0 --port 3001`
5. 다른 터미널에서 헬스 체크: `curl -I http://localhost:3001/healthz` → `200 OK`
6. 종료 후 `docs/worklog.md` 에 검증 결과 기록

## 4. 배포 절차 (예시)
1. `main` 병합 → CI에서 `pytest`, `pyright`, `ruff` 성공 확인
2. 컨테이너 이미지 빌드: `IMAGE_PREFIX=registry/alumni PUSH_IMAGES=1 ./ops/cloud-build.sh`
3. DB 마이그레이션 적용: `API_IMAGE=registry/alumni-api:<태그> ENV_FILE=/etc/secrets/api.env ./ops/cloud-migrate.sh`
4. 서비스 재시작: `API_IMAGE=... WEB_IMAGE=registry/alumni-web:<태그> API_ENV_FILE=/etc/secrets/api.env WEB_ENV_FILE=/etc/secrets/web.env ./ops/cloud-start.sh`
5. 프로빙: `curl https://api.alumni.sogang-econ.kr/healthz` 응답 확인, 주요 엔드포인트 스팟 체크

> 참고: `API_ENV_FILE`에는 `DATABASE_URL`, `JWT_SECRET`, `PUSH_*`, `SENTRY_*` 등 필수 시크릿을 포함한다. 컨테이너 업로드 볼륨은 `UPLOADS_DIR=/var/lib/segecon/uploads` 로 기본 설정되어 있으며, 필요 시 커스터마이즈한다.

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
