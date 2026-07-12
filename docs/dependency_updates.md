# 의존성 업데이트 및 보안 예외 정책

## 정기 업데이트

- Dependabot은 매월 1일 02:00 KST부터 npm, pip, GitHub Actions를 순차 점검한다.
- minor/patch는 ecosystem과 production/development 위험도별로 그룹화한다.
- major는 그룹에 포함하지 않고 독립 PR로 생성한다.
- ecosystem별 version update PR 상한은 5개다.
- 자동 병합은 사용하지 않는다. 자동 PR도 일반 PR과 같은 필수 CI와 리뷰를 통과해야 한다.

## 보안 업데이트와 SLA

Dependabot alerts와 security updates를 활성화한다. 보안 업데이트는 월간 일정을 기다리지 않고 advisory 감지 시 PR을 생성한다.

| 심각도 | 최초 분류 | 수정 또는 완화 목표 |
| --- | --- | --- |
| Critical | 1영업일 이내 | 3일 이내 |
| High | 2영업일 이내 | 7일 이내 |
| Moderate | 5영업일 이내 | 30일 이내 |
| Low | 다음 월간 점검 | 90일 이내 |

production과 개발 도구의 영향 경로를 구분하되 개발 도구라는 이유만으로 종료하지 않는다.

## Waiver 필수 항목

취약점 예외는 GitHub 이슈로만 관리하며 advisory, 정확한 의존 경로, 영향 분석, 차단 근거, 완화책, 잔여 위험, 담당자, 절대 날짜 만료일, 제거 조건과 제거 이슈를 모두 포함한다. 만료된 waiver는 자동 연장하지 않는다.

## 운영 절차

1. 자동 PR의 공식 release/security 근거와 범위를 확인한다.
2. major 또는 서로 다른 위험 영역은 PR을 합치지 않는다.
3. manifest·lockfile·`docs/versions.md`·버전 가드 정합을 확인한다.
4. 필수 CI, audit, API/Web 계약 검증을 완료한다.
5. 실패한 자동 PR은 닫기 전에 원인과 후속 이슈를 기록한다.

설정 SSOT는 `.github/dependabot.yml`, 검증 가드는 `ops/ci/check_dependabot.py`다.
