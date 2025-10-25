# 2025-10-25 추가 로그

- Web 헤더 4분할(grid) 적용 및 로그인 링크 위치 조정.
- 헤더 드롭다운(롤아웃) 도입: 총동문회 소개/고객 지원 NavDropdown 추가.
- 드롭다운 hover 이탈 방지: 진입/이탈 지연 타이머 160ms 적용, 간극 축소.
- 미로그인 시 /auth/session 호출 생략(useAuth enabled=false) — 401/CORS 로그 감소.
