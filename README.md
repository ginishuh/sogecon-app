# 서강대학교 경제대학원 총동문회 앱

공개 레포지터리로 운영되는 서강대학교 경제대학원 총동문회 웹 애플리케이션 모노레포입니다. 참고용 공식 사이트: https://sogangeconomics.com

## 구성 요소
- `apps/web`: Next.js 기반 공개 웹 프런트엔드
- `apps/api`: FastAPI 기반 백엔드 API
- `packages/schemas`: OpenAPI 스키마를 TS 타입으로 변환하는 도구 패키지
- `infra`: 개발용 Postgres 컨테이너 정의
- `ops`: 향후 클라우드 자동화 훅을 위한 플레이스홀더 스크립트
- `docs`: TODO, 워크로그(`worklog.md`), 일일 개발 로그(`dev_log_YYMMDD.md`) 정리 공간

아키텍처: web(3000) → API(3001) → Postgres(docker)

## 로컬 개발

### 데이터베이스
```
docker compose -f infra/docker-compose.dev.yml up -d
```

### API
```
python -m venv .venv && source .venv/bin/activate
pip install -r apps/api/requirements.txt -r apps/api/requirements-dev.txt
alembic -c apps/api/alembic.ini upgrade head
uvicorn apps.api.main:app --reload --port 3001
```

### Web
```
corepack enable
pnpm -C apps/web i && pnpm -C apps/web dev
```

## 메모
- 현재 범위는 로컬 개발 환경에 한정됩니다.
- VPS 및 클라우드 배포는 추후 ops 스크립트를 활용해 확장할 예정입니다.

### 테스트
```
source .venv/bin/activate
pytest -q
```
