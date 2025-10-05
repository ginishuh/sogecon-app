# Worklog

## 2025-10-05
- 모바일 웹 우선 원칙과 PWA/Web Push 지원을 아키텍처에 반영, SMS 채널 보류 명시 및 세부 가이드(`docs/pwa_push.md`) 추가
- 에이전트 베이스 문서 추가(`docs/agents_base.md`, `docs/agents_base_kr.md`) 및 AGENTS/CLAUDE/Copilot 문서 동기화
- 품질 가드 도입: 우회 주석 금지/파일 600줄 제한/복잡도 가드 스크립트(`ops/ci/guards.py`), Ruff/Pyright/ESLint 설정 강화
- CI에 레포 가드 잡 추가, 프리커밋 훅에 레포 가드 실행 포함
- API 레이트리밋 도입(`slowapi==0.1.9`), 기본 per-IP 120/minute. FastAPI 미들웨어와 예외 핸들러 연결
- pre-push 훅이 활성 venv 우선으로 `pyright` 실행 후, 테스트 존재 시 `pytest -q`까지 수행하도록 강화
- commit-msg 훅 실행 권한 추가 및 Conventional Commits 규칙 적용 확인
- pyright 오류 수정: SecurityHeadersMiddleware.dispatch 타입 보강 및 레이트리밋 예외 핸들러 래퍼; 마이그레이션 폴더는 pyright 제외
- pre-push 훅: 테스트 파일 탐색 로직 수정(매치 없을 때 pytest 미실행)
- repo-guards: 빌드 산출물 `.next` 디렉터리 제외(@ts-ignore false positive 방지)

## 2025-09-28
- .gitignore에 mypy/ruff 캐시 폴더를 추가해 불필요한 상태 변화를 제거
- AGENTS.md 본문을 영어로 통일하면서 한국어 우선 커뮤니케이션 규칙을 유지
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
- `.github/copilot-instructions.md`를 추가하여 AI 코딩 에이전트용 가이드를 정리
- `docs/architecture.md`를 신설하고 에이전트 지침 문서에 교차 링크를 추가
