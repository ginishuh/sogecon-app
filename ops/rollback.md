# 배포 롤백 가이드 (초안)

## 1. 공통 원칙
- 롤백 전 마지막 성공 배포와 현재 상태를 비교하고, 사용자 영향 범위를 즉시 공유한다.
- 모든 명령 실행 후 로그/모니터링을 확인하고 `docs/worklog.md` 에 조치 기록을 남긴다.
- 데이터베이스 마이그레이션이 포함된 릴리스는 **배포 전 백업** 을 필수로 준비한다.

## 2. 웹 (Next.js)
1. 배포 플랫폼에서 이전 안정 버전(예: 이전 Git SHA/빌드 번호)으로 트래픽 라우팅
   - Vercel: `vercel rollback <deployment>` 또는 Dashboard “Promote previous”
   - Fly: `fly deploy --image <previous>` 또는 `fly releases revert`
2. 캐시 무효화: CDN/에지 캐시를 이전 버전으로 비움 (`vercel deploy --preload false` 등)
3. 헬스 체크: `curl -I https://sogangeconomics.com/`
4. 문제 원인 분석 후 재배포 일정 수립

## 3. API (FastAPI)
1. 컨테이너/서비스 재배포: `docker service update --image <prev> alumni-api` 또는 `kubectl rollout undo deployment/alumni-api`
2. DB 롤백 필요 시 `alembic downgrade <revision>` 적용 (사전 백업 기반)
3. 헬스 체크: `curl -I https://api.sogangeconomics.com/healthz`
4. SlowAPI 레이트리밋 상태와 에러 로그 재확인

## 4. 후속 조치
- 재발 방지를 위해 실패 원인과 대응 절차를 `docs/dev_log_YYMMDD.md` 에 정리
- 필요 시 `docs/todo.md` 에 개선 과제 추가
- 운영 채널(슬랙 등)에 롤백 시간, 영향도, 다음 액션 공지
