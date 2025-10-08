# M3 Push Polish — 운영 마감(251007)

목표: Web Push 운영 경로의 문서화·관측·운영편의 보강으로 ‘실사용 가능한’ 품질 도달.

## 범위(Scope)
- 문서화: KEK(대칭키) 로테이션 절차, 장애/404/410 자동 무효화 운영 체크리스트.
- 테스트: admin 발송 429 케이스 추가(동시/연속), invalid payload 422 확장, 통계 API 단위테스트.
- 관리 UI: 로그 정리(prune) 버튼/피드백, 통계 기간 필터(최근 24h/7d/30d).
- 보안/프라이버시: 로그 마스킹 규칙 재점검(엔드포인트 tail/해시만 노출 유지), 예외 시 실패-안전 코드 경로 재확인.

비범위(Out of Scope)
- 구독 정보 암호화 방식 변경(현재 AES‑GCM 유지)과 키 관리 외부화(KMS)는 M3.5로 분리.
- 멤버 개인화 주제/토픽 구독은 후속 마일스톤.

## 변경 계획(Tasks)
1. 문서 보강
   - `docs/pwa_push.md`: 운영 체크리스트 추가(레이트리밋, 404/410 자동 폐기, 백업/복구, 테스트 절차).
   - `docs/security_hardening.md`: KEK 로테이션 절차(더블암호화/그레이스 기간), 로그 마스킹 표.
2. API/테스트
   - `POST /notifications/admin/notifications/test` 429: 연속 호출·동시 호출 케이스 추가.
   - 통계 기간 필터: `GET /notifications/admin/notifications/stats?range=24h|7d|30d`.
   - prune 결과 UI 피드백값 확장 `{deleted, before, range}`.
3. Web(UI)
   - Admin 화면에 기간 선택(24h/7d/30d), prune 버튼·결과 토스트, encryption 상태 강조.
4. 관측/로그
   - 실패 코드 분포(404/410/others) 요약을 통계에 포함.

## 수락 기준(Definition of Done)
- 문서 2종 업데이트 반영, 운영 체크리스트 포함.
- 테스트 3+ 케이스 추가(429 동시성, invalid payload 422, 통계 기간 필터).
- Admin UI에서 기간 필터·prune 동작 확인.
- CI green(ruff/pyright/pytest/next build/semgrep/audit).

## 리스크/대응
- 레이트리밋 환경 의존성 → 테스트에서 ASGITransport IP 고정 사용(기존 패턴 준수).
- 기간 필터 성능: SQLite 경로에서 날짜 비교 최적화(인덱스 부재 고려) 및 제한된 범위만 제공.

## 참고
- SSOT: `docs/architecture.md` Web Push 섹션, `docs/pwa_push.md`, `docs/security_hardening.md`.

