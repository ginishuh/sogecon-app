# 에이전트 실행 지침 검토 안내

> 에이전트가 실제로 따르는 실행 SSOT는 저장소 루트의 `AGENTS.md`다.
>
> 이 문서는 대표님과 유지보수자가 지침의 설계 의도를 검토하기 위한 한국어 참고자료다. 에이전트 문서로 복제하거나 실행 시 자동으로 적재하지 않는다.

## 설계 목표

루트 지침은 저장소에서 반복적으로 필요한 판단만 제공한다. 제품 요구사항, 아키텍처, 디자인, 보안, 운영 절차는 각 도메인 SSOT가 담당한다. 이 구조는 지침 중복과 오래된 규칙의 확산을 줄이고, 변경된 코드와 가까운 검증 장치가 세부 정책을 강제하도록 한다.

## 루트 지침에 남기는 내용

- 대표와 협업할 때의 정체성, 호칭, 기본 말투
- 저장소의 주요 디렉터리와 책임
- 작업 종류에 따른 SSOT 문서 라우팅
- API, Web, 데이터베이스, 인증, 개인정보, 생성 계약의 불변조건
- 실제로 실행할 수 있는 검증 명령
- 로컬 개발과 운영 배포의 경계
- 외부 상태 변경과 파괴적 작업의 권한 경계
- 완료 보고 형식

## 세부 규칙의 위치

| 규칙 | 관리 위치 |
| --- | --- |
| 제품 범위와 사용자 흐름 | `docs/Project_overview.md` |
| 계층과 계약 | `docs/architecture.md` |
| UI와 접근성 | `docs/design_system.md` |
| PWA와 구독정보 보호 | `docs/pwa_push.md` |
| 버전 고정 | `docs/versions.md`, `ops/ci/check_versions.py` |
| 보안 정책 | `docs/security_hardening.md`, `SECURITY.md` |
| lint, type, 복잡도, 파일 크기 | 각 설정 파일, `ops/ci/guards.py`, CI |
| 훅과 CI 책임 | `docs/ci_quality_gates.md`, `.githooks`, `.github/workflows` |
| 배포와 롤백 | `docs/agent_runbook_vps.md`, `ops` 스크립트 |
| 커밋 형식 | `docs/commit_message_convention.md`, commit hook |

## 어댑터 원칙

`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`는 루트 `AGENTS.md`를 가리키는 짧은 어댑터다. 공통 규칙을 복제하지 않으므로 실행 지침 변경은 루트 파일 한 곳에서 검토한다.

## 검토 체크리스트

- 루트 지침이 현재 디렉터리와 실제 명령을 가리키는가
- 제품·운영 세부사항이 해당 SSOT 문서에 있는가
- 코드로 강제할 규칙이 설정·guard·CI에 구현되어 있는가
- 어댑터가 공통 규칙을 다시 복제하지 않는가
- 권한 경계와 완료 보고가 실제 업무 흐름에 맞는가
