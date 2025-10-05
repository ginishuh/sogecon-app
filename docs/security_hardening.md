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
- Next.js 보안 헤더(`apps/web/next.config.js`)
  - CSP: 기본 `self` 엄격, 개발에서는 `unsafe-eval` 허용(프로덕션 제외)
  - HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy 등
- FastAPI 보안 헤더 미들웨어(`apps/api/main.py`)
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`
- CORS: `CORS_ORIGINS` 환경 변수 기반 화이트리스트
- 레이트리밋: SlowAPI 기반 per-IP 제한(`RATE_LIMIT_DEFAULT`, 기본 120/minute)

## 운영 권장(추가)
- 경계 레이트리밋: API Gateway/Ingress 레벨에서 IP/토큰 기반 제한(로그인/활성화/알림 발송 강제)
- TLS: HSTS 프리로드 등록 전 도메인·서브도메인 HTTPS 적용 검증
- 비밀 관리: `.env`는 로컬 전용, 운영은 시크릿 매니저 사용(KMS 암호화, 버전/교체 정책)
- 로깅/감사: 요청 ID/사용자 ID/행위/리소스/성공 여부 기록. 민감 데이터 마스킹

## 검토 체크리스트
- [ ] CI가 우회 주석/600줄 초과를 정확히 차단하는가
- [ ] pnpm/pip-audit/semgrep 실패 시 PR이 막히는가
- [ ] 프로덕션에서 CSP(스크립트) 정책이 동작하고 위반이 콘솔에 기록되는가
- [ ] API 응답이 브라우저 캐시에 저장되지 않는가(`no-store`)
