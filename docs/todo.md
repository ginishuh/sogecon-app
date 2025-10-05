# TODO

- [ ] FastAPI 라우터에 실제 비즈니스 로직 추가
- [ ] Next.js 페이지에 서버 데이터 연결
- [ ] CI에 테스트 러너 추가 (pytest, vitest)
- [ ] 인프라 IaC 설계 초안 작성
## PWA / 알림 (모바일 웹 우선)
- [ ] PWA 매니페스트 정리(아이콘/이름/시작 URL/standalone)
- [ ] 서비스워커 초안 추가(`apps/web/public/sw.js`)
- [ ] 구독 등록 컴포넌트 구현(`apps/web/app/sw-register.tsx`)
- [ ] 구독 저장 API 추가(`POST /notifications/subscriptions`)
- [ ] VAPID 키 발급/주입(`.env.example` 갱신)
- [ ] 예약 발송 워커(공지/행사 D-3/D-1)
- [ ] 권한 온보딩 UX(대시보드 안내)
- [ ] SMS 채널 보류 표기 및 폴백 정책 문서화
