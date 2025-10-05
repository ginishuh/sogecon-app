# 에이전트 베이스 (Korean)

이 문서는 이 레포지토리의 에이전트 가이드라인 ‘원문(국문)’입니다. 모든 에이전트 문서(AGENTS.md, CLAUDE.md, .github/copilot-instructions.md 등)는 영문 베이스(`docs/agents_base.md`)를 기준으로 동기화하며, 충돌 시 영문 베이스가 우선합니다. 본 문서는 동일 규칙을 한국어로 병기합니다.

## 범위와 동기화
- 에이전트/에디터 가이드 및 코드 품질 가드레일의 단일 기준 문서.
- 다른 문서는 이 파일에 링크하고 세부 중복을 피합니다(규칙은 동일, 예시는 축약 가능).

## 품질 가드레일(강제)

### 1) 린트/타입 우회 금지(기본 금지)
전역/파일 단위로 린터나 타입체커를 끄지 마세요.
- 금지 예: `/* eslint-disable */`, `// eslint-disable-next-line`, `// @ts-nocheck`, `// @ts-ignore`, `# type: ignore`, `# pyright: ignore`, `# noqa`(파일 전역·광범위).
- 유일한 예외: Alembic `apps/api/migrations/env.py`의 `# noqa: E402` (도구 제약 때문).
- 정말 필요한 경우에만 ‘1줄 국부 억제’를 허용하며, 아래를 모두 만족해야 합니다.
  1) 구체 규칙 ID 명시(예: 설명 포함 `@ts-expect-error`, `noqa: F401`),
  2) 인라인 사유(무엇/왜),
  3) 이슈 링크 또는 제거 계획/일자.

### 2) 가드 불가 타입 및 위험 캐스트 금지
- TypeScript: `any`, 이중 캐스트(`as unknown as T`), 과도한 non-null(`!`) 금지. `unknown`+내로잉, 판별 유니온, 생성된 DTO 사용.
- Python: `Any`, `dict[str, Any]`, `list[Any]`, 광범위 `object` 지양. Pydantic 모델/TypedDict/제네릭 명시 사용.

### 3) 복잡도·스파게티 방지
- 순환 복잡도 ≤ 10(함수 단위). Python: Ruff mccabe(C901), TS: ESLint `complexity`.
- 중첩 깊이 ≤ 4(ESLint `max-depth`).
- import 순환 금지(ESLint `import/no-cycle`).

### 4) 모듈 크기·구조
- 소스 파일 1개당 최대 600줄(생성된 마이그레이션 제외). 초기에 분리 습관화.
- 레이어링 고정:
  - API: Router → Service → Repository/DB. Router에서 ORM 직접 접근 금지.
  - Web: UI 컴포넌트 → hooks/services → API client. 공용 클라이언트가 있을 때 컴포넌트 직접 fetch 금지.

### 5) 예외 처리/로깅
- Python: `except:`/`except Exception:` 금지(구체 예외로 제한). 침묵 처리 금지.
- TS: `no-floating-promises` 준수(거부 누락 금지).

### 6) 알림·프라이버시(Web Push)
- 구독 정보는 민감 데이터로 취급. 저장 시 암호화, 로그 마스킹, 404/410 응답 시 즉시 폐기.

## 테스트·CI 기대치
- Pyright strict, Ruff 복잡도 검사, ESLint로 TS 규칙 강제.
- Python 도구(ruff/pyright/pytest)는 반드시 레포의 `.venv`에서 실행합니다. `make venv`, `make api-install`, `make test-api` 타겟을 사용하세요.

## 커밋/PR 규칙
- 모든 커밋은 Conventional Commits 형식을 따릅니다: `type(scope): subject`(헤더 72자 제한).
- type: `feat|fix|refactor|perf|test|chore|build|ci|docs`, scope: `api|web|schemas|infra|docs|ops|ci|build`.
- 제목은 명령형·현재 시제로 작성하며 한국어 사용 가능. 자세한 규칙: `docs/commit_message_convention.md`.
- `commit-msg` 훅이 pnpm dlx 기반 고정 버전 `@commitlint/cli`로 즉시 검증하며, CI에서도 최근 커밋을 재검증합니다.
- 비-문서 변경은 `docs/worklog.md` 한 줄 요약 필수, 푸시 시 당일 `docs/dev_log_YYMMDD.md`가 포함되어야 합니다.

## 언어/커뮤니케이션
- 기본 언어: 레포 내 모든 내부 문서와 코드 주석은 한국어를 원칙으로 합니다.
- 코드 주석: 기본 한국어로 작성합니다. 식별자(변수/함수/타입)는 영어를 사용하되, 도메인 이해에 유리하면 한국어 용어를 허용합니다.
- 사용자 노출 문자열: 특별한 요구가 없는 한 한국어를 기본으로 합니다.
- 커밋/PR: 커밋 메시지와 PR 설명은 한국어로 작성합니다.
- 예외(영문 유지 허용): 외부 라이브러리/벤더 코드, 자동 생성 파일, 라이선스 전문, 프로토콜 상수, 외부 시스템 인용, 외부 API 페이로드/픽스처 등.
- 불가피하게 영어만 가능한 기술 자료를 추가하는 경우, 가능하면 같은 변경 안에 한국어 요약/주석을 함께 남깁니다.
- 레포 가드(Repo Guards)가 다음 시에 실패 처리:
  - 금지된 우회 주석 감지,
  - 600줄 초과 파일,
  - 본 문서의 기타 규칙 위반.

## 예외·면제
- 유일 예외: `apps/api/migrations/env.py`의 `# noqa: E402`.
- 임시 면제는 반드시 이슈 링크/담당자/만료일 포함. 글로벌 설정으로 면제 금지.

## 편집 정책
- 변경은 `agents_base.md`와 `agents_base_kr.md`를 동시에 업데이트하고, AGENTS.md/CLAUDE.md에서 해당 변경을 참조합니다.
