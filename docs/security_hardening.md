# Security Hardening

본 문서는 현재 레포에 적용된 보안 가드와 운영 권장 설정을 요약합니다.

## CI / 자동화 가드
- Repo Guards(`ops/ci/guards.py`):
  - 금지된 우회 주석 감지(`eslint-disable`, `@ts-ignore`, `# type: ignore`, `# noqa` 등; Alembic env.py의 `E402`만 예외)
  - 파일 600줄 초과 차단
- Python: `ruff`(복잡도/버그베어/pyupgrade), `pyright` strict
- 취약점 스캔: `bandit -r apps/api`, `pip-audit`(두 requirements 모두)
- Web: `pnpm -C apps/web build` + `pnpm -C apps/web audit --audit-level=high`
- SAST: Semgrep 기본 규칙(`p/ci`)
- 비밀 탐지: Gitleaks

## 애플리케이션 가드
- Next.js 보안 헤더(`apps/web/middleware.ts`, `apps/web/next.config.js`)
  - CSP는 미들웨어에서 요청별 nonce를 생성해 주입한다. 프로덕션 기본값: `script-src 'self' 'nonce-<...>' https://www.googletagmanager.com`, `connect-src 'self' https: https://www.google-analytics.com` 등. 인라인 스크립트는 nonce 없이는 실행되지 않는다.
  - `NODE_ENV !== 'production'` 또는 `NEXT_PUBLIC_RELAX_CSP=1` 시에는 HMR/DevTools를 위해 `unsafe-inline`, `unsafe-eval`, `ws:` 및 localhost 오리진을 추가 허용한다.
  - `next.config.js`는 나머지 보조 헤더(HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy 등)를 유지하며 CSP는 덮어쓰지 않는다. Next.js App Router는 FOUC 방지를 위해 인라인 `<style>` 태그를 삽입하므로 `style-src 'self' 'unsafe-inline'`을 예외적으로 허용한다.
- FastAPI 보안 헤더 미들웨어(`apps/api/main.py`)
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`
- CORS: `CORS_ORIGINS` 환경 변수 기반 화이트리스트
- 레이트리밋: SlowAPI 기반 per-IP 제한(`RATE_LIMIT_*` 환경변수; 상세 표 참조)
- Web Push 보강:
   - 구독 at-rest 암호화(옵션): `PUSH_ENCRYPT_AT_REST=true`, `PUSH_KEK=base64(32B)` 설정 시 endpoint/p256dh/auth를 AES-GCM으로 암호화 저장(접두사 `enc:v1:`), 조회/삭제는 `endpoint_hash(SHA-256)`로 결정.
   - 로그 프라이버시: 발송 로그는 endpoint의 SHA-256 해시 + 말미 16자만 저장.
   - 죽은 구독 정리: 404/410 응답 시 즉시 폐기, 관리자 `prune-logs`로 오래된 로그 정리.

### 레이트리밋 프로필

| 기능 | 환경 변수 | 기본값 | 적용 경로 |
| --- | --- | --- | --- |
| 전역 기본 | `RATE_LIMIT_DEFAULT` | `120/minute` | SlowAPI 미들웨어 기본값 |
| 로그인(회원/관리자) | `RATE_LIMIT_LOGIN` | `5/minute` | `/auth/member/login`, `/auth/member/activate`, `/auth/member/change-password`, `/auth/login` |
| 관리자 알림 발송 | `RATE_LIMIT_NOTIFY_SEND` | `6/minute` | `POST /notifications/admin/notifications/send` |
| Web Push 구독/해지 | `RATE_LIMIT_SUBSCRIBE` | `30/minute` | `POST/DELETE /notifications/subscriptions` |
| 문의 접수 | `RATE_LIMIT_SUPPORT` | `1/minute` | `POST /support/contact` |
| 커뮤니티 게시글 작성(멤버) | `RATE_LIMIT_POST_CREATE` | `5/minute` | `POST /posts` (멤버 작성 한정) |

### 관측/로깅

- `RequestContextMiddleware` 가 요청당 `request_id` 를 생성하고 `X-Request-Id` 헤더로 반환한다.
- `apps/api/logging_utils.py` 의 JSON 라인 로거가 `method`, `path`, `status`, `duration_ms`, `request_id`, `code` 등을 기록한다.
- 예외 핸들러는 `emit_error_event` 로 Sentry에 오류 이벤트를 전송한다(DSN 미설정 시 no-op). 전송 시 `request_id`·`http.method`·`http.path`만 태그에 첨부하고 `code`/`status` 정도만 extra 로 포함해 PII를 배제한다.
- Sentry 연동(`SENTRY_DSN` 설정 시 활성화):
  - `APP_ENV`, `RELEASE` 태그와 `request_id`, `http.method`, `http.path` 태그를 자동 부여한다.
  - 샘플링 기본값은 트레이스 0.05, 프로파일 0.0이며 `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE` 로 조정한다.
  - PII 전송 필요 시 `SENTRY_SEND_DEFAULT_PII=true` 로 명시하며, 기본은 비활성화된다.
  - 알림 기준(권장): 5분 rolling 5xx 비율 ≥ 5%, 개별 5xx 발생 시 Slack/메일 알림 트리거.

## 운영 권장(추가)
- 경계 레이트리밋: API Gateway/Ingress 레벨에서 IP/토큰 기반 제한(로그인/활성화/알림 발송 강제)
- TLS: HSTS 프리로드 등록 전 도메인·서브도메인 HTTPS 적용 검증
- 비밀 관리: `.env`는 로컬 전용, 운영은 시크릿 매니저 사용(KMS 암호화, 버전/교체 정책)
- 로깅/감사: 요청 ID/사용자 ID/행위/리소스/성공 여부 기록. 민감 데이터 마스킹
- 세션 보안: 운영에서 세션 쿠키 Secure + SameSite=Strict 권장, 로그인 시도 레이트리밋(5/min/IP)
- 키 관리: PUSH_KEK는 시크릿 매니저 관리(KMS 암호화), 주기적 회전(더블 키 + 롤링 기간), 폐기 절차 수립

### Web Push KEK 로테이션 절차(무중단 지향)

목표: at-rest 암호화 키(KEK)를 정기적으로 교체하되, 데이터 무결성과 가용성을 보장.

사전 준비
- 비상 복구: 전체 DB 스냅샷 백업(스키마/데이터), 애플리케이션 이미지 버전 태깅
- 시크릿: `REKEY_OLD_PUSH_KEK`, `REKEY_NEW_PUSH_KEK`(base64-encoded 16/24/32B) 발급·검증
- 점검: 운영이 `PUSH_ENCRYPT_AT_REST=true`인지 확인

단계별 수행
1) 유지보수 창 공지(짧은 창 권장; 쓰기 중단이 어려우면 구독 경로만 일시 차단)
2) 앱은 기존 설정 유지(PUSH_KEK=old). 서버는 정상 서비스 지속
3) 재암호화 수행(op):
   - 명령:
     - 드라이런: `REKEY_OLD_PUSH_KEK=... REKEY_NEW_PUSH_KEK=... python -m ops.rekey_push_kek --dry-run`
     - 실제 실행: `REKEY_OLD_PUSH_KEK=... REKEY_NEW_PUSH_KEK=... python -m ops.rekey_push_kek`
   - 동작: `push_subscriptions`의 `endpoint/p256dh/auth`를 새 KEK로 재암호화. `endpoint_hash`는 평문 기준이므로 변경 없음
   - 성공 기준: 업데이트 건수=총 행수(이미 신규 키로 암호화된 행은 건너뜀)
4) 앱 전환: 환경변수 `PUSH_KEK`를 NEW로 교체 후 롤링 재시작
5) 검증: Admin UI에서 알림 발송(최근 실패/성공·분포 확인). 이상 없으면 유지보수 종료
6) 폐기: OLD 키 파기·감사로그 기록

주의/한계
- 앱은 런타임에서 단일 KEK만 사용하므로 재암호화 완료 후에만 `PUSH_KEK` 전환 권장
- 실패 시 즉시 백업에서 복구(드라이런 결과와 실제 실행 로그를 보관)
- 로그에는 endpoint 해시/말미만 남고 전체값은 기록되지 않음(프라이버시)


## 검토 체크리스트
- [ ] CI가 우회 주석/600줄 초과를 정확히 차단하는가
- [ ] pnpm/pip-audit/semgrep 실패 시 PR이 막히는가
- [ ] 프로덕션에서 CSP(스크립트) 정책이 동작하고 위반이 콘솔에 기록되는가
- [ ] API 응답이 브라우저 캐시에 저장되지 않는가(`no-store`)
