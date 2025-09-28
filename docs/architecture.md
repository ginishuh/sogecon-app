# 기술 개요서

## 문서 목적
스케폴드 단계에서 확정한 구조적 결정을 한눈에 정리해 개발·운영 참여자 간의 공통 이해를 확보한다. 주요 모듈 책임, 데이터 모델, 통신 방식, 품질 가드레일, 향후 확장 포인트를 요약하여 설계 변경 시 검토 근거로 활용한다.

## 시스템 전반 개요
- **사용자 대상 웹 서비스**: 서강대학교 경제대학원 총동문회 회원이 공지, 이벤트, RSVP를 관리하는 포털.
- **프런트엔드 (`apps/web`)**: Next.js(App Router) 기반의 SSR/SSG 혼합 아키텍처. Tailwind CSS, PWA 설정을 포함하며 한국어 UI를 기본값으로 제공한다.
- **백엔드 API (`apps/api`)**: FastAPI + SQLAlchemy 조합으로 RESTful API를 제공한다. Pydantic 스키마(`schemas.py`)가 요청/응답 검증과 문서화를 담당한다.
- **데이터 스토어**: 개발 기본값은 SQLite(`sqlite:///./dev.sqlite3`), 운영 전환 시 PostgreSQL 16( `infra/docker-compose.dev.yml` 참조 )을 사용한다. ORM 레벨에서 두 엔진 모두 호환되도록 설계했다.
- **스키마 공유 (`packages/schemas`)**: FastAPI에서 생성한 `openapi.json`을 TypeScript DTO로 변환하여 프런트엔드에서 타입 안정성을 확보한다.

## 도메인 모델
| 엔터티 | 주요 속성 | 설명 |
| --- | --- | --- |
| `Member` | `email`, `name`, `cohort`, `roles`, `visibility` | 회원 기본 정보와 노출 범위 설정. 역할 문자열(`member`, `admin` 등)로 권한 제어 예정. |
| `Post` | `author_id`, `title`, `content`, `published_at` | 공지/게시글. `published_at` 내림차순 인덱스로 최신 게시물 조회 최적화. |
| `Event` | `title`, `starts_at`, `ends_at`, `location`, `capacity` | 모임 일정. 시작 일시 인덱스로 일정 정렬 제공. |
| `RSVP` | `member_id`, `event_id`, `status` | 회원과 이벤트 간 다대다 관계. 기본 상태는 `going`, 취소·대기열 상태를 Enum으로 제한한다. |

> 데이터 무결성: SQLAlchemy 관계에 `cascade="all, delete-orphan"`를 지정해 회원/이벤트 삭제 시 종속 레코드 정리. RSVP는 복합 PK로 중복 응답을 방지한다.

## 백엔드 구조
- **진입점**: `apps/api/main.py`에서 FastAPI 앱 구성, `router` 묶음을 include.
- **라우터 구성**: `routers/` 디렉터리에 `members.py`, `posts.py`, `events.py`, `rsvps.py`. 각 파일은 CRUD 스텁으로 시작하며, 비즈니스 규칙 확장 시 모듈 단위로 책임을 분리한다.
- **DB 세션 관리**: `db.py`의 `get_db()` 의존성을 통해 요청 단위 세션 생성/정리.
- **마이그레이션**: `migrations/` 하위 Alembic 스크립트로 버전 관리. 새로운 모델 변경 시 `alembic revision --autogenerate` 사용 후 코드 검토.
- **예정 기능**: 인증(예: OAuth2, SSO), 권한 레이어, 감사 로깅, 웹훅 등은 추후 설계 항목으로 남겨둔다.

## 프런트엔드 구조
- **App Router** 기반 디렉터리 구조(`apps/web/src/app`). 페이지 단위 서버 컴포넌트와 클라이언트 컴포넌트를 혼합.
- **데이터 패칭**: REST API 호출을 위해 `fetch` 래퍼 또는 `@tanstack/react-query` 도입을 검토한다. 초기에는 SSR에서 서버 액션을 통해 데이터 Hydration을 제공한다.
- **UI 패턴**: Tailwind 유틸리티 클래스 + Headless UI 계열 컴포넌트 활용. 다국어는 i18n 준비만 해두고 한국어를 기본값으로 한다.
- **PWA**: `public/manifest.json`, Service Worker 설정 포함. 알림 기능 필요 시 Web Push 연동을 추후 고려.

## 통신 및 계약
- **REST 규약**: `/members`, `/posts`, `/events`, `/rsvps` 네임스페이스. JSON 응답, ISO 8601 타임스탬프 사용.
- **오류 포맷**: FastAPI 기본 `HTTPException` 구조(`{"detail": "..."}`)를 유지. 도메인 오류는 추후 `code` 필드를 확장.
- **스키마 동기화**: `make schema-gen` 실행 → `packages/schemas`에서 TypeScript DTO 갱신 → `apps/web`에서 import. 프런트 작업 전 항상 API 변경분을 반영한다.

## 품질 및 운영 가드레일
- **정적 검사**: `ruff`, `pyright`, `eslint`, `tsc --noEmit`.
- **테스트**: `pytest -q`로 API 단위 테스트, 웹 쪽은 `vitest`/`@testing-library/react` 도입 예정.
- **CI 파이프라인**: PR Ready 전환 시 lint → type check → build 순서. 비밀 검출은 `gitleaks`로 수행.
- **로그 정책**: 코드 변경 시 `docs/worklog.md`, 개발 세션 별로 `docs/dev_log_YYMMDD.md` 업데이트.

## 배포 및 환경 구성
- **개발 환경**: `make web-dev`(포트 3000), `make api-dev`(포트 3001). 필요 시 `make db-up`으로 PostgreSQL 16 컨테이너 기동.
- **환경 변수**: `.env.example`을 최신화해 필수 설정 목록을 유지. 실제 `.env`는 커밋 금지.
- **프로덕션 가정**: API와 웹을 분리 배포하되, 공통 인증 게이트웨이(Nginx, CloudFront 등) 뒤에 배치. 데이터베이스는 매니지드 PostgreSQL 사용을 권장.

## 향후 결정이 필요한 항목
1. 인증 체계: 동문회 계정 관리 방식(학교 계정 연동 vs 자체 가입) 및 세션 전략.
2. 권한/역할 설계: `roles` 문자열을 Enum 구조로 정규화할지 여부.
3. 알림 채널: 이메일, 카카오톡 챗봇, 푸시 등 채널 선정과 발송 인프라.
4. 데이터 이력: 게시글·이벤트 수정 이력, 감사 로그 보존 정책.
5. 관측성: 로깅·모니터링 스택(ELK, OpenTelemetry 등) 채택 여부.

이 문서는 스케폴드 이후 아키텍처 변경 사항이 생길 때마다 함께 업데이트하며, 변경 내역은 해당 날짜의 `docs/dev_log_YYMMDD.md`에 링크한다.
