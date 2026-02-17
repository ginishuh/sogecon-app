# Issue #113 데이터 리셋 실행 가이드

## 목적
- 기존 더미 회원/인증/신청 데이터를 초기화하고 가입신청 기반 플로우로 전환합니다.
- 운영 로그성 데이터(`notification_send_logs`, `scheduled_notification_logs`, `support_tickets`)는 보존합니다.

## 사전 조건
- 점검창에서 실행합니다.
- API 가동 중이면 쓰기 트래픽을 잠시 중단합니다.
- `.venv` 및 의존성이 준비되어 있어야 합니다.

## 실행 절차
1. 환경 점검
```bash
make info-venv
```

2. 파괴적 리셋 실행
```bash
ALLOW_DESTRUCTIVE_RESET=1 make reset-data
```

3. 관리자 bootstrap 시드 실행(후속 이슈에서 관리자 전용 시드 정비 후)
```bash
make seed-data
```

4. 동작 확인
- 관리자 로그인 가능 여부 확인
- `members`, `member_auth`가 bootstrap 관리자 계정만 포함하는지 확인
- 로그성 테이블 데이터가 유지되는지 확인

## 리셋 대상(현재)
- `comments`
- `posts`
- `rsvps`
- `member_auth`
- `notification_preferences`
- `push_subscriptions` 중 `member_id IS NOT NULL`
- `signup_requests` (테이블이 아직 없으면 자동 스킵)
- `members`

## 주의사항
- `ALLOW_DESTRUCTIVE_RESET=1`이 없으면 커맨드는 실패합니다.
- 본 작업은 되돌릴 수 없으므로 실행 전 백업 상태를 확인합니다.
