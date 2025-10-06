# M2 계획(세션 인증/권한 + RSVP v2)

이 브랜치는 M2 작업(간단 세션 기반 인증/권한, RSVP 대기열 승급 v2)의 기반 PR입니다.

- 인증: /auth(login/logout/me), 세션 쿠키(HttpOnly, SameSite=Lax, prod Secure), bcrypt 해시
- 권한: require_admin 의존성 적용(작성/수정/삭제 보호)
- RSVP v2: cancel 시 waitlist 자동 승급(트랜잭션)
- 테스트: 인증 성공/실패, 보호 라우트(401/403), 승급 로직, 레이트리밋
- 문서: architecture/README에 정책 반영

체크리스트
- [ ] Alembic: admin_users 마이그레이션
- [ ] /auth 3종 구현 + 세션 미들웨어
- [ ] require_admin 적용
- [ ] RSVP v2 + 테스트
- [ ] Web: /login, useAuth, 보호 라우팅
- [ ] 문서 갱신
