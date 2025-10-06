# M3 계획(Web Push)

## 목표
- Web Push 구독 저장/해지 API와 테스트 발송(Admin 전용) 구현
- 프런트에서 구독/해지 흐름 및 SW 푸시 핸들링 추가
- 민감정보/레이트리밋 최소 가드 적용

## 범위(스코프)
- API
  - `POST /notifications/subscriptions` 구독 저장(중복 엔드포인트 idempotent)
  - `DELETE /notifications/subscriptions` 구독 삭제(또는 revoke)
  - `POST /admin/notifications/test` 관리자 전용 테스트 발송
- DB
  - `push_subscription` 테이블(엔드포인트 unique, p256dh, auth, ua, created_at, last_seen_at, revoked_at)
  - (선택) `notification_preference` 초안
- Web
  - `public/sw.js` push/notificationclick 핸들러
  - `app/sw-register.tsx` 구독/해지 + API 연동
  - 로그인 후 CTA로 노출
- 보안/운영
  - 404/410 시 구독 자동 폐기
  - Admin 테스트 발송 레이트리밋(예: 1/min/IP)

## 완료 기준(DoD)
- 개발환경에서 구독/해지/테스트 발송이 동작
- 죽은 구독(404/410) 자동 정리
- 테스트 6+ 추가(API 구독/해지/중복/어드민 발송 경로)
- CI 그린

## 작업 순서(체크리스트)
- [ ] DB 마이그레이션 2건 추가(0004, 0005)
- [ ] API 라우터 `notifications.py` 추가 및 권한 가드
- [ ] pywebpush 연동(개발키; prod는 Secret Manager 상정)
- [ ] Web SW/구독 모듈 추가 및 연결
- [ ] 테스트: `tests/api/test_notifications.py`
- [ ] 문서: `docs/architecture.md`, `docs/execution_plan_251006.md` 갱신

## 참고
- VAPID 공개키는 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` 사용(.env.example에 추가)

