# schemas package

OpenAPI 문서를 기반으로 TypeScript DTO를 생성하는 스크립트 패키지입니다.

## 사용 방법
1. API 서버가 실행 중인지 확인합니다 (`http://localhost:3001`).
2. 루트에서 `pnpm -C packages/schemas install` 후, `pnpm -C packages/schemas run gen`을 실행합니다.
3. 생성된 `openapi.json`과 `index.d.ts`는 커밋 여부를 팀에서 결정합니다.
