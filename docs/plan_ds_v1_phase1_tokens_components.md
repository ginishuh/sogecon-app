# DS v1 Phase 1 — 토큰/프리미티브/공통 컴포넌트 (초안)

## 목적
- Tailwind 기반 디자인 토큰 수립과 기본 UI 컴포넌트를 제공해 화면 전반의 일관성을 확보한다.

## 작업 항목
1) 토큰
   - `apps/web/tailwind.config.ts`: semantic colors(brand/bg/surface/text/primary/secondary/error/warn/info/success), spacing scale(4/8/12/16/24), radius(sm/md/lg), shadow(depth), container padding.
   - 다크 모드 보류(토큰에 훅만 마련).
2) 타이포/글로벌 스타일
   - `apps/web/app/globals.css`: 타이포 스케일(h1–body), 본문 행간, 링크/포커스 링.
3) 공통 UI 컴포넌트
   - `apps/web/components/ui/{button,input,select,textarea,badge,card,tabs}.tsx`
   - 접근성: label/aria, 키보드 포커스, 역할/상태 속성.
4) 테스트
   - 각 컴포넌트 렌더 스냅샷 + 간단 상호작용(버튼 클릭/탭 전환).

## DoD
- [ ] 토큰/타이포 반영 후 `pnpm -C apps/web build` 그린
- [ ] 컴포넌트 7종 기본 상태/비활성/에러 변형 제공
- [ ] vitest 스냅샷/상호작용 추가/통과
- [ ] 문서: `docs/design_system.md` 갱신(토큰·컴포넌트 예시)

## 브랜치/PR
- branch: `feat/ds-v1-phase1-tokens`
- PR Title: `feat(web): DS v1 — 토큰/프리미티브/공통 컴포넌트 1차`
- 정책: Draft로 올린 뒤, 컴포넌트 7종과 빌드/테스트 그린 상태에서 Ready

## 리스크/메모
- 스냅샷 변동 대량 → 컴포넌트 단위 커밋/리뷰
- 색 대비(AA) 유지 필수, 폰트 로딩으로 CLS 방지
