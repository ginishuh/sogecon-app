# 커밋 메시지 규칙(Conventional Commits)

- 형식: `type(scope): subject`
- 길이: 제목(헤더) 72자 이내
- 타입(type): `feat|fix|refactor|perf|test|chore|build|ci|docs`
- 스코프(scope): `api|web|schemas|infra|docs|ops|ci|build`
- 문체: 명령형, 현재 시제. 한국어 권장.
- 본문(선택): 배경/의도 → 핵심 변경점 → 영향(마이그레이션, 호환성)
- 푸터(선택): 관련 이슈/문서, BREAKING CHANGE

예시
- `feat(api): SlowAPI 기반 레이트리밋 추가(기본 120/min)`
- `chore(web): Next 15/React 19로 업그레이드 및 engines 고정`

검사 도구
- 훅: `.githooks/commit-msg`가 `commitlint`로 즉시 검증합니다.
- CI: PR에서도 최근 커밋 메시지를 검사합니다.

구성 파일
- `docs/commitlint.config.cjs`

