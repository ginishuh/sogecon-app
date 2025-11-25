# 2025-11-25 - MCP 설정 정리

## 요약
- sogecon-app 레포에서 로컬 `.mcp.json` 설정 파일을 제거하고, Codex/Claude/Gemini/Copilot/Droid가 공통 전역 MCP 설정을 사용하도록 정리.

## 영향 범위
- 코드 실행 경로 변경 없음.
- MCP 서버/클라이언트 설정이 전역 설정 파일로 일원화되어 레포 내 중복 설정을 줄임.
