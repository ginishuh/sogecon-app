# 계획서 — 2025-10-08 (웹 런치: 소개(E)/홈/SEO·A11y)

## 배경 / SSOT 정합성
- 기준: `docs/Project_overview.md`(IA), `docs/execution_plan_251006.md`(로드맵), `docs/plan_251008.md`(B v2/C v1/M4 일부 완료)
- 현황: 내부 기능/운영 준비는 M4(일부)까지 도달. 대외 노출(콘텐츠/디자인) 중심의 웹 런치 단계 필요.

## 목표(이번 사이클)
- 소개(E) 정적 페이지 3종(회장 인사·조직도·역대 회장단) + 내비 연결
- 홈(메인) 히어로/카드 레이아웃 1차 + 브랜드 토큰(색·간격·타이포) 정리
- SEO/메타(OG·sitemap·robots) + 기본 Analytics
- 접근성/성능: Lighthouse A11y/Perf ≥ 90 목표

## 범위(Scope)
### E: 소개 정적 페이지
- 라우트: `/about/greeting`, `/about/org`, `/about/history`
- 컴포넌트: 공통 Hero 섹션, 콘텐츠 블록(이미지+텍스트), 목차/탭(선택)
- 카피/이미지: 초기 더미 텍스트/플레이스홀더 → 실제 자료 수합 시 교체

### 홈 레이아웃/브랜드 토큰
- 히어로(메인 카드) + 공지/행사 카드 그리드(재사용 컴포넌트)
- 디자인 토큰: 색상 팔레트, 간격 scale, 타이포 scale, 버튼/배지 변형
- 반응형: md/lg 브레이크포인트 기준 카드 배치 전개

### SEO/메타/분석
- title/description/OG 태그 템플릿, OpenGraph 이미지 기본
- `sitemap.xml`/`robots.txt` 생성(Next route)
- 기본 Analytics(페이지뷰; 추후 이벤트 확장)

### 접근성/성능
- 포커스 이동/키보드 내비, landmark/aria-label
- 이미지 alt/캡션, 컬러 대비, 스킵 링크
- 이미지 최적화/지연 로딩, 캐시 헤더 점검

## 산출물(DoD)
- 소개(E) 3페이지가 내비에서 접근 가능, 라우팅/레이아웃 정상
- 홈 히어로/카드 컴포넌트 1차 적용, 브랜드 토큰 반영
- sitemap/robots/OG 메타 적용, 기본 Analytics 로드 확인
- Lighthouse A11y/Perf ≥ 90(로컬) 리포트 캡처
- 테스트: 간단 스냅샷/접근성 속성/SEO 메타 존재 확인

## 작업 순서(브랜치/PR)
1) feat/e-intro-pages — `/about/*` 3페이지, 내비/레이아웃 연동, 스냅샷 테스트
2) feat/home-hero-cards — 히어로/카드/토큰 정리 + 홈 레이아웃
3) chore/seo-setup — 메타/OG/sitemap/robots, 기본 Analytics
4) chore/a11y-lh — 접근성/성능 패스 및 Lighthouse 리포트 기록

## 위험/의존성
- 실제 카피/이미지 수급 일정 → 초기 더미로 배포 가능(플래그/주석으로 표시)
- 브랜드 색/로고 확정 → 토큰/OG 이미지 최종화에 영향

## 측정/검증
- Lighthouse A11y/Perf ≥ 90
- vitest: 페이지 스냅샷·SEO 메타·접근성 속성 테스트 6+개
- 빌드 OK, 페이지 라우팅 정상

## 일정(권고)
- E 페이지: 0.5~1일
- 홈/토큰: 1일
- SEO/A11y: 0.5~1일

## 문서/SSOT 반영
- `docs/architecture.md`에 IA/라우트 표 갱신(About/홈 구성)
- `docs/worklog.md`, `docs/dev_log_251008.md`에 진행 기록

---

## 병행 내부 후속(B v2 / C v1 / M4)

### B v2 후속
- 연락처/주소/직함/부서 검증 규칙 문서화 동기화(`docs/architecture.md`), 폼 힌트/에러 카피 미세 조정
- 업종/전공 표준 목록 도입(선택): 서버 enum/lookup + 마이그레이션 검토
- 아바타 저장 정책 확정: `MEDIA_ROOT`/`MEDIA_URL_BASE` 운영 경로, 용량(≤100KB)/확장자(JPEG/PNG) 가드, 교체/삭제 흐름 문서화

### C v1 고도화
- URL 동기화 범위/정책 확정(디바운스/페이지 reset 규칙)과 SSR/캐시 전략 정리
- 접근성 개선 라운드: 포커스 이동, 라이브 영역, 키보드 내비게이션 점검 → Lighthouse A11y ≥ 90
- 정렬/추가 필터(최근수정/기수순 등)와 count 성능 검토

### M4 본격화
- 보안/성능: 프로덕션 CSP 강화, 레이트리밋 정책 분리(로그인/발송/문의), 구조화 로그(code/request_id) 표준화
- 배포 파이프라인 확정(Fly/Render/EC2 중 택1), 헬스체크·옵저버빌리티(대시보드/알림) 구성
- DTO 동기화 파이프라인 CI 연계(스키마 변경 시 웹 타입 재생성 검증)
