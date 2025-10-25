# 2025-10-25 추가 로그

- Web 헤더 4분할(grid) 적용 및 로그인 링크 위치 조정.
- 헤더 드롭다운(롤아웃) 도입: 총동문회 소개/고객 지원 NavDropdown 추가.
- 드롭다운 hover 이탈 방지: 진입/이탈 지연 타이머 160ms 적용, 간극 축소.
- 미로그인 시 /auth/session 호출 생략(useAuth enabled=false) — 401/CORS 로그 감소.
- 모바일에서 NEXT_PUBLIC_WEB_API_BASE가 localhost일 때 현재 호스트로 자동 대체.
- 로그인 직후 Drawer 상태 동기화(useAuth 쿼리 함수 가드) 적용.
 - 헤더 심볼 추가 및 타이틀 폰트 상향(text-base → md:text-lg)
 - 데스크톱 레이아웃 보정: 로고/타이틀 영역 `md:col-span-2`로 확장, 타이틀 `whitespace-nowrap` 처리로 줄바꿈 방지
