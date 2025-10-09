# DS v1 Phase 0 — 설계 문서(SSOT) 추가 (초안)

## 목적
- 디자인 시스템 v1의 공통 원칙/토큰/컴포넌트 범위를 SSOT 문서로 정의한다.
- 이후 단계(Phase 1~4)의 구현 기준점으로 사용한다.

## 산출물
- `docs/design_system.md` — 디자인 원칙, 토큰 체계(colors/spacing/radius/shadow/container), 타이포 스케일, 공통 컴포넌트 목록(Button/Input/Select/TextArea/Badge/Card/Tabs), 반응형/접근성 규칙.
- `docs/architecture.md` — Design System 섹션 링크 추가.

## 작업 항목
1) 문서 스캐폴드 작성: design principles, tokens, components, responsive/a11y policy
2) 예시 스니펫 포함(Tailwind 토큰 예시, 컴포넌트 API 표)
3) SSOT 링크 업데이트(architecture.md)
4) PR 본문/체크리스트 준비

## DoD(체크리스트)
- [ ] `docs/design_system.md`에 원칙/토큰/컴포넌트/반응형/a11y 명시
- [ ] `docs/architecture.md` 링크 추가
- [ ] 빌드·테스트 영향 없음 확인

## 브랜치/PR
- branch: `feat/ds-v1-phase0-doc`
- PR Title: `docs(plan): DS v1 Phase 0 — 설계 문서(초안)`
- PR Policy: 계획만 PR 금지 — 본 PR은 문서 변경이므로 Draft로 올리고, 리뷰 후 바로 Phase 1에서 구현 병행

## 리스크/메모
- 용어/구성 일관성: Project_overview·architecture와 충돌 금지
- 장기 유지: 토큰은 semantic 중심으로 정의(브랜드 색상 변경 시 비용↓)
