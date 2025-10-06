# 기술 개요서

## 문서 목적
스케폴드 단계에서 확정한 구조적 결정을 한눈에 정리해 개발·운영 참여자 간의 공통 이해를 확보한다. 주요 모듈 책임, 데이터 모델, 통신 방식, 품질 가드레일, 향후 확장 포인트를 요약하여 설계 변경 시 검토 근거로 활용한다.

## 시스템 전반 개요
- **사용자 대상 웹 서비스**: 서강대학교 경제대학원 총동문회 회원이 공지, 이벤트, RSVP를 관리하는 포털.
- **프런트엔드 (`apps/web`)**: Next.js(App Router) 기반의 SSR/SSG 혼합 아키텍처. Tailwind CSS, PWA 설정을 포함하며 한국어 UI를 기본값으로 제공한다. 모바일 웹 우선(모바일 퍼스트)로 반응형을 설계한다.
- **백엔드 API (`apps/api`)**: FastAPI + SQLAlchemy 조합으로 RESTful API를 제공한다. Pydantic 스키마(`schemas.py`)가 요청/응답 검증과 문서화를 담당한다.
  - 인증/권한(개발 단계): 세션 쿠키 기반 관리자 로그인(/auth), 생성/수정/삭제 라우트는 `require_admin`으로 보호한다. 쿠키는 HttpOnly + SameSite=Lax(개발), 운영에서는 Secure 적용.
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
- **레이어드 아키텍처(강제)**: Routers → Services → Repositories/DB. 라우터는 ORM을 직접 사용하지 않는다(SSOT 규칙 준수).
  - `apps/api/services/`: 도메인 규칙·상태 전이·예외를 담당. HTTP 의존성 금지, `apps/api/errors.py`의 도메인 예외를 발생.
  - `apps/api/repositories/`: SQLAlchemy를 통한 영속성 접근. 쿼리/정렬/페이징 책임을 가짐.
- **라우터 구성**: `routers/` 하위 `members.py`, `posts.py`, `events.py`, `rsvps.py`가 서비스만 호출하도록 리팩터링 완료(초판).
- **DB 세션 관리**: `db.py`의 `get_db()` 의존성을 통해 요청 단위 세션 생성/정리.
- **마이그레이션**: `migrations/` 하위 Alembic 스크립트로 버전 관리. 새로운 모델 변경 시 `alembic revision --autogenerate` 사용 후 코드 검토.
- **예정 기능**: 인증(예: OAuth2, SSO), 권한 레이어, 감사 로깅, 웹훅 등은 추후 설계 항목으로 남겨둔다.

## 프런트엔드 구조
- **App Router** 기반 디렉터리 구조(`apps/web/app`). 페이지 단위 서버/클라이언트 컴포넌트 혼합.
- **레이어드 아키텍처(강제)**: UI Components → Hooks/Services → API Client. 컴포넌트는 공용 클라이언트가 존재할 때 직접 `fetch`를 호출하지 않는다(SSOT 규칙 준수).
  - `apps/web/lib/api.ts`: 공통 fetch 래퍼(에러/BASE_URL/헤더 일관화).
  - `apps/web/services/*.ts`: 도메인 서비스. 페이지는 서비스 함수만 호출.
- **데이터 패칭**: 초기판은 CSR `useEffect` + 서비스 호출. 후속으로 `@tanstack/react-query`와 서버 컴포넌트/캐싱 전략 도입 검토.
- **UI 패턴**: Tailwind 유틸리티 클래스 + Headless UI 계열 컴포넌트 활용. 다국어는 i18n 준비만 해두고 한국어를 기본값으로 한다.
- **PWA**: `public/manifest.json`, 서비스 워커. 모바일 웹 우선 UX 전제로 오프라인 스켈레톤, 설치 가능한 PWA 제공. Web Push 1차 채널, SMS 보류.

## 통신 및 계약
- **REST 규약**: `/members`, `/posts`, `/events`, `/rsvps` 네임스페이스. JSON 응답, ISO 8601 타임스탬프 사용.
- **오류 포맷**: FastAPI 기본 `HTTPException` 구조(`{"detail": "..."}`)를 유지. 도메인 오류는 추후 `code` 필드를 확장.
  - 인증 에러 코드: `login_failed`, `unauthorized` 등은 Problem Details `detail`/`code`로 제공하여 프런트 매핑이 가능하도록 한다.
- **스키마 동기화**: `make schema-gen` 실행 → `packages/schemas`에서 TypeScript DTO 갱신 → `apps/web`에서 import. 프런트 작업 전 항상 API 변경분을 반영한다.

### 오류 처리 전략(절충안; Problem Details)
- 서비스/리포지토리: 프레임워크 비의존 `ApiError` 파생 예외만 발생(`NotFoundError`, `AlreadyExistsError`, `ConflictError`). 각 예외는 안정적 `code`, `detail`, 권장 `status`를 포함한다.
- 전역 예외 핸들러: `ApiError`를 RFC7807-lt(경량) JSON으로 매핑해 응답.
  - 응답 형태: `{ type: "about:blank", title: "", status: <int>, detail: <string>, code: <string> }`
- 라우터: 예외 변환을 수행하지 않고 서비스만 호출(얇은 라우터).
- 초기 코드 카탈로그(가이드): `member_not_found`, `post_not_found`, `event_not_found`, `rsvp_not_found`, `member_exists`, `rsvp_exists`, `conflict`.
- 프런트 처리: `code`를 기준으로 UX 분기(예: `member_exists` → 필드 하이라이트, `rsvp_exists` → 안내 토스트).

## 인증/권한(요약)
- 로그인: `POST /auth/login`(email, password) → 세션 쿠키 발급(HttpOnly, SameSite=Lax; prod Secure).
- 세션 조회: `GET /auth/me` → `{ id, email }`.
- 로그아웃: `POST /auth/logout` → 세션 제거.
- 보호 라우트: posts/events/members 생성 시 `require_admin` 의존성 적용.
- 레이트리밋: 로그인 시도 `5/min/IP`(SlowAPI), 글로벌 기본 제한은 설정값(`RATE_LIMIT_DEFAULT`).

## RSVP 규칙
- v1: 정원 초과 시 요청은 `waitlist`로 강제. 기존 참석자의 재요청은 유지.
- v2: 참석자 `cancel` 시 대기열(created_at 기준) 최상위 1인을 `going`으로 자동 승급(트랜잭션).

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
3. 알림 채널: 이메일/푸시 중심으로 운영하며 SMS는 1차 릴리스에서 제외(보류). 카카오톡 챗봇 등은 차기 검토.
4. 데이터 이력: 게시글·이벤트 수정 이력, 감사 로그 보존 정책.
5. 관측성: 로깅·모니터링 스택(ELK, OpenTelemetry 등) 채택 여부.

## PWA / Web Push 아키텍처(모바일 웹 우선)
모바일 웹 사용성을 최우선으로 다음 원칙을 따른다.
- 성능 목표: 모바일 P95 LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1(홈·목록 기준). 이미지 `srcset`/`sizes`, 폰트 디스플레이 스왑, 중요한 경로 CSS 최소화 적용.
- 반응형: 모바일 360–414px 뷰포트 기준으로 1차 설계, 데스크톱은 확장.

알림은 Web Push를 1차 채널로 제공한다(SMS 보류).

### 프런트엔드 구성 (`apps/web`)
- 매니페스트: `apps/web/public/manifest.json` — 이름, 아이콘(192/512), `display: standalone`, `start_url: /dashboard`.
- 서비스 워커: `apps/web/public/sw.js`(또는 `next-pwa` 커스텀 SW) — `push`, `notificationclick`, `install`, `activate` 핸들러 포함.
- 구독 등록 UI: `apps/web/app/sw-register.tsx` — 권한 요청(`Notification.requestPermission`), 서비스워커 등록, `PushManager.subscribe`로 엔드포인트·키 수집 후 API로 전송.
- 권한 UX: 최초 진입에서 즉시 요청하지 않고, 대시보드 온보딩 단계에서 맥락(행사 알림 등)을 설명 후 요청.

### 백엔드 구성 (`apps/api`)
- 구독 저장 엔드포인트: `POST /notifications/subscriptions` — 바디에 `endpoint`, `keys.p256dh`, `keys.auth`, `ua`, `member_id`(서버에서 식별) 저장. 테이블 예: `push_subscription(id, member_id, endpoint, p256dh, auth, ua, created_at, last_seen_at, revoked_at)`.
- 테스트 발송 엔드포인트(운영자): `POST /admin/notifications/test` — 샘플 N명에게 미리보기 발송.
- 예약/대량 발송: APScheduler 혹은 별도 워커 프로세스에서 Web Push를 큐잉 처리. 재시도/TTL/배치 크기 제어.
- 키 관리: VAPID 공개/비공개 키 쌍을 `.env`로 주입(`VAPID_PUBLIC_KEY`,`VAPID_PRIVATE_KEY`,`VAPID_SUBJECT`). 키 순환 시 롤링 기간 동안 구독 재발급 유도.

### 운영 가드레일
- 레이트리밋: 구독 등록/삭제, 발송 API에 IP·계정별 제한.
- 옵트인/옵트아웃: `NotificationPreference(member_id, channel='webpush', topic, enabled)` 모델로 토픽 단위 제어.
- 장애 복원: HTTP 410(Gone)/404 응답 구독은 즉시 폐기 처리, 연속 실패 카운트 임계 시 비활성화.
- 프라이버시: 구독 엔드포인트/키는 암호화 at-rest, 감사 로그에 마스킹.

### 구현 메모
- iOS/Android 주요 브라우저에서 설치형 PWA 기준 Web Push 지원. 설치되지 않은 상태, 또는 지원 불가 환경에서는 이메일로 폴백(Phase 1에선 폴백 없이 UI만 안내 가능).
- 프런트 키 배포: VAPID 공개키를 빌드 타임/런타임 노출(환경변수 → 페이지 데이터 주입)하고, 비공개키는 서버 전용으로 보관.


이 문서는 스케폴드 이후 아키텍처 변경 사항이 생길 때마다 함께 업데이트하며, 변경 내역은 해당 날짜의 `docs/dev_log_YYMMDD.md`에 링크한다.
