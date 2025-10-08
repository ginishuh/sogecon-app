# schemas package

OpenAPI 문서를 기반으로 TypeScript DTO를 생성하는 스크립트 패키지입니다.

## 사용 방법
1. 루트 `.venv`가 준비되어 있어야 합니다(`make venv`).
2. 루트에서 `pnpm -C packages/schemas run gen`을 실행하면 FastAPI 앱을 직접 로딩해 `openapi.json`을 생성한 뒤 `index.d.ts`를 갱신합니다.
3. 생성된 `openapi.json`과 `index.d.ts`는 커밋 여부를 팀에서 결정합니다.
