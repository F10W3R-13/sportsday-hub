# AGENTS.md

이 저장소에 AI 코딩 도우미(Claude Code, ZCode 등)가 접속했을 때를 위한 안내.

## 가장 먼저 읽을 것

**[`HANDOVER/00_개요와_연간_사이클.md`](HANDOVER/00_개요와_연간_사이클.md)** —
이 시스템의 구조·연간 사이클·운영 원칙(단일 진실 원천 등)이 정리되어 있다.
작업 전 반드시 읽고, 사용자가 후계자(비개발자)일 수 있음을 전제로 설명할 것.

## 저장소 규칙 요약

- 웹앱은 `sportsday-hub/` (Root Directory). 검증: `npm run typecheck && npm test`.
- 연도·팀·행사일 등 이벤트 값은 `sportsday-hub/lib/event-config.ts` 가 단일 원천 — 곳곳에 하드코딩 금지.
- 당일 배치 데이터는 `sportsday-hub/lib/dayof/data.ts`(+`copy.ts`)와 `briefing-build/roster.js`
  양쪽에 존재하며 수동 동기화됨 — 한쪽만 고치지 말 것.
- 실명이 포함된 작년 자료는 `archive/` — 수정하지 말 것.
- 폐지된 기능(카톡봇·드라이브싱크봇) 재제안 금지 — HANDOVER/07 역사 노트 참조.
- 커밋 메시지는 한글, conventional 접두어(feat/fix/docs/chore/refactor) 사용.
