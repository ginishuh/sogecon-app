# 계획서 — 2025-10-09 디자인 시스템 v1 · 모바일 최적화

## 1) 배경 / 목표
- 런치 이후 운영 안정화가 끝난 시점에서, 모바일 우선 사용성을 강화하고 UI 일관성(디자인 시스템)을 수립한다.
- 성능·접근성 지표를 CI로 상시 검증(Lighthouse 모바일 Perf/A11y ≥ 0.90)하며, 단계별로 화면에 실제 반영한다.

## 2) SSOT 정렬(참조 문서)
- 제품 개요/IA/범위: `docs/Project_overview.md`
- 아키텍처/레이어링: `docs/architecture.md`
- 보안/운영(CSP·관측·레이트리밋·SAST): `docs/security_hardening.md`
- 버전/도구 고정: `docs/versions.md`
- 에이전트 베이스(품질 규칙/금지 패턴): `docs/agents_base*.md`

## 3) 범위(Scope)
- 디자인 시스템 v1 수립: Tailwind 토큰(색/간격/모서리/섀도/컨테이너), 타이포 스케일, 공통 UI(버튼/입력/셀렉트/텍스트영역/배지/카드/탭).
- 모바일 최적화: 디렉터리 카드 뷰(md 미만), 필터 아코디언·풀폭 입력, 탭/버튼 터치 타겟 44–48px, 홈/헤더 드로어 내비.
- 성능/접근성: next/image `sizes/priority`, 폰트 로딩, a11y 라벨/포커스 트랩/스킵 링크 정비.
- CI 보강: Lighthouse 워크플로에 `/directory`, `/board` 추가(모바일 프로필 유지), 예산 파일 유지.

## 4) 비범위(Out of Scope)
- 브랜드 리브랜딩(로고·팔레트 전면 교체), 다국어, 애니메이션 고도화.

## 5) 성공 기준 / 지표
- Lighthouse(모바일) Perf/A11y ≥ 0.90(홈/디렉터리/게시판).
- CLS < 0.1, LCP 안정, a11y 규칙 위반 0(필수 라벨/포커스/대비).
- vitest 스냅샷/상호작용 ≥ 기존 + 신규 케이스 통과.

## 6) 산출물(DoD)
- 토큰/타이포/컴포넌트 문서: `docs/design_system.md`(신규).
- 공통 UI 컴포넌트(버튼/입력/셀렉트/텍스트영역/배지/카드/탭) + 사용 예시.
- 디렉터리 모바일 카드 뷰(요약/펼치기), 필터 아코디언, 공유 링크 토글.
- 게시판 카드 스타일/카테고리 탭 터치 타겟/작성 폼 키패드.
- Lighthouse 워크플로 URL 확장 및 리포트 그린.

## 7) 단계 / 작업 항목

### Phase 0 — 설계 문서(SSOT) 추가 (0.5d)
- `docs/design_system.md` 초안: 디자인 원칙(가독성/대비/접근성), 토큰 체계, 컴포넌트 목록, 반응형 규칙.
- `docs/architecture.md`에 링크 추가.

### Phase 1 — 토큰/프리미티브(1.5d)
- Tailwind 토큰: semantic colors, spacing(4/8/12/16/24), radius(sm/md/lg), shadow(depth), container 패딩.
- `apps/web/app/globals.css` 타이포 스케일(h1~body), 포커스 링/링크/본문 행간.
- 공통 UI: `components/ui/{button,input,select,textarea,badge,card,tabs}.tsx`.
- 테스트: 각 컴포넌트 렌더 스냅샷, 상호작용 최소(버튼 클릭/탭 전환).

### Phase 2 — 디렉터리 모바일(1.0d)
- md 미만 카드 뷰 + 요약/펼치기, md 이상 기존 테이블 유지.
- 필터 아코디언 + 100% 폭 입력 + 적절한 inputMode/autoComplete.
- 공유 링크 노출 토글(정보 밀도 완화).
- 테스트: 카드 렌더/아코디언 상호작용/공유 링크 토글.

### Phase 3 — 게시판/내비/폼(1.0d)
- 게시판 카드 리스트(카테고리 배지/날짜/제목/요약), 탭/버튼 터치 타겟 44–48px.
- 작성 폼: 모바일 키패드/에러 문구/접근성 라벨 정비.
- 헤더 모바일 드로어(포커스 트랩/스크롤 잠금) 베타.
- 테스트: 탭 전환/폼 제출/드로어 키보드 포커스 흐름.

### Phase 4 — 성능/접근성 마감(0.5d)
- next/image `sizes` 지정, LCP 이미지 priority, 지연 로딩 점검.
- Lighthouse 워크플로 URL 확장: `/directory`, `/board` 추가(모바일 대상).
- 퍼포먼스 예산 파일(`lighthouse-budget.json`) 유지.

## 8) 파일/모듈 영향(예상)
- 토큰/타이포: `apps/web/tailwind.config.ts`, `apps/web/app/globals.css`.
- 공통 UI: `apps/web/components/ui/*`(신규), `apps/web/components/layout/*`(선택).
- 디렉터리: `apps/web/app/directory/page.tsx`(카드뷰 분기), `apps/web/app/directory/state.ts` 재사용.
- 게시판: `apps/web/app/board/page.tsx`, `apps/web/app/board/new/page.tsx`.
- 헤더: `apps/web/components/site-header.tsx`(또는 동등 파일) 드로어/내비 추가.
- CI: `.github/workflows/lighthouse.yml` URL 목록 확장.
- 문서: `docs/design_system.md`(신규), `docs/architecture.md` 링크 업데이트.

## 9) CI / 품질 가드
- Lighthouse(모바일) Draft 스킵, Ready/Push에서만 실행. Perf/A11y ≥ 0.90 어서션.
- Repo Guards/ESLint/Ruff/DTO verify 기존 정책 유지(Any 금지, broad-except 금지, 600줄 제한 등).

## 10) 위험 / 대응
- 스냅샷 대량 변경 → 컴포넌트 단위 PR로 쪼개기, 리뷰어 가이드를 PR 본문에 첨부.
- 성능 회귀 위험 → 이미지/폰트 정책을 먼저 적용, Lighthouse 예산 유지로 감시.
- 접근성 회귀 → 폼 라벨/aria/포커스/대비 체크리스트 포함, vitest 상호작용 테스트 추가.

## 11) 롤백 전략
- UI 회귀 시 각 Phase PR을 리버트 가능하도록 변경을 독립 유지.
- 토큰 변경은 변수 레이어를 경유(컴포넌트 직접 하드코딩 금지) → 토큰 교체만으로 표준 복구.

## 12) 일정(권고)
- Phase 0: 0.5d / Phase 1: 1.5d / Phase 2: 1.0d / Phase 3: 1.0d / Phase 4: 0.5d
- 총 4.5d(버퍼 제외). 병행 가능 구간: Phase 0 → 1 착수와 병행.

## 13) 승인 게이트(Ready 전)
- 각 Phase PR은 반드시 최소 구현 포함(“계획만 PR 금지”).
- 체크리스트: 빌드/테스트 그린, Lighthouse 기준 통과, 문서 업데이트(설계/변경점/스크린샷) 포함.

## 14) 커밋/PR 규칙(상기 베이스 문서 준수)
- Conventional Commits(한국어 OK), 문서/코드 변경 분리 권장.
- 비-문서 변경 시 `docs/worklog.md`, 당일 `docs/dev_log_YYMMDD.md` 업데이트.

## 15) 커맨드(로컬 검증)
- Web: `pnpm -C apps/web build` / `pnpm -C apps/web test`
- Lighthouse(로컬): `pnpm -C apps/web start` 후 모바일 프리셋 측정.
- CI: Ready PR에서 lighthouse/dto-verify 자동 검증.

