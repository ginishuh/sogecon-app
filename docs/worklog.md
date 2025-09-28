# Worklog

## 2025-09-28
- 프로젝트 스캐폴드 구성 완료 (API, Web, Schemas, Infra, Ops)
- 프리커밋/프리푸시 훅 및 CI 구성 초안 마련
- pyright 타입 검사를 .venv 기반 dev requirements에 통합하고 프리커밋/CI와 연동
- 훅 중복 검사를 줄이기 위해 pre-commit/CI 책임을 분리하고 pre-push에서 pyright만 실행하도록 조정
- AGENTS.md를 최신 가이드(훅 역할 분리, Draft PR 정책 등)로 갱신
- pytest를 dev requirements에 추가하고 문서/가이드에 테스트 실행 방법을 반영
- FastAPI 라우터 반환 값을 Pydantic으로 검증해 pyright 오류를 제거하고 enum 캐스팅을 보완
- pyright 경고를 해소하기 위해 RSVP 상태 설정 방식을 조정하고 config에 루트 경로를 추가
- 프리푸시 훅이 API 건강 체크 후 스키마 생성을 수행하도록 개선
- Next.js 빌드가 권장하는 tsconfig/next-env 업데이트를 반영해 반복 diff를 방지
- 홈 화면에서 실시간 fetch 대신 안내 문구로 헬스 체크 정보를 전달하도록 단순화
- README 상단에 영어 요약 및 quickstart를 병기해 국제 협업 대비

