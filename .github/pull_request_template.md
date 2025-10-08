# PR 템플릿 (Draft → Ready)

> 이 템플릿은 Draft PR 기준으로 작성됩니다. 초안 단계에선 상단 섹션만 채우고, 검토 요청(Ready for Review) 시 체크리스트를 모두 확인해 주세요.

## 배경/목적
- 문제/요구사항:
- 목표/범위(Scope):
- 비범위(Out of Scope):

## 주요 변경사항
- API:
- Web:
- 스키마/마이그레이션:
- 문서(architecture/pwa_push/versions 등):

## 스크린샷/데모(선택)
- [ ] UI 변경이 있는 경우 캡처/동영상 첨부

## 테스트 노트
- 수동 테스트 절차:
- 예상 영향 범위:

## 배포/롤백
- 배포 전 체크(마이그레이션 등):
- 롤백 전략:

---

## Draft 체크리스트(초안 단계)
- [ ] 문제 정의와 범위를 템플릿에 명시했다
- [ ] API/DB/Web 중 어디를 건드리는지 표시했다
- [ ] 남은 TODO를 본문에 정리했다(작은 단위 권장)
- [ ] 필요 시 와이어프레임/모형/샘플 데이터 첨부
- [ ] (계획서 포함 시) 본 PR에서 계획 범위를 전부 구현할 것임을 명시했다

## Ready for Review 체크리스트(검토 요청 시)
- 일반
  - [ ] Conventional Commits 규칙을 따른다(`type(scope): subject`, 72자 이내)
  - [ ] 한국어 커밋/PR 설명, 한국어 코드 주석(베이스 문서 규정 준수)
  - [ ] `docs/worklog.md` 업데이트(코드 변경마다 1줄)
  - [ ] `docs/dev_log_YYMMDD.md` 최신 항목 포함(비-문서 변경 푸시용)
- 품질/규칙(Repo Guards와 일치)
  - [ ] 린트 우회 주석 없음(`eslint-disable`, `@ts-...`, `# type: ignore`, `# noqa` 등)
  - [ ] 모듈 600줄 이하, 순환복잡도 ≤ 10, import cycle 없음
  - [ ] TS에 `any`/이중 캐스트/과도한 non-null 미사용, Python에 `Any` 기반 페이로드 회피
- API
  - [ ] 로컬 `pyright` 통과, `ruff` 통과(우회 주석 없이)
  - [ ] 마이그레이션이 있으면 `alembic -c apps/api/alembic.ini upgrade head` 확인
  - [ ] 레이트리밋/보안 헤더 영향 검토(변경 시 `docs/security_hardening.md` 반영)
- Web
  - [ ] 로컬 `pnpm -C apps/web build` 성공(경고/에러 없음)
  - [ ] ESLint(Flat config) 통과, 우회 주석 없음
  - [ ] Tailwind 유틸/토큰 사용 검증(필요 시 스냅샷 첨부)
- 보안/컴플라이언스
  - [ ] 비밀/자격증명/토큰 미포함, `.env` 변경 없음
  - [ ] 외부 데이터/로그에 개인 식별 가능 정보 미노출
- 문서
  - [ ] 변경 사항이 `docs/architecture.md`, `docs/pwa_push.md`, `docs/versions.md` 등과 모순되지 않음
  - [ ] (계획서 포함 시) 계획서 범위를 본 PR에서 전부 구현 완료했고, 문서/SSOT를 반영했다

> 체크리스트 통과 후, PR을 Ready for Review 상태로 전환해 주세요. CI는 Ready 상태에서만 전체 실행됩니다.
