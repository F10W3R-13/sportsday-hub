# 스포츠데이 시스템 (연간 템플릿)

스포츠데이 기획을 위한 통합 시스템 — **기획 허브 웹앱 + 브리핑 자료 제작 도구 + 작년 기록 아카이브**.
2026-2학기에 처음 도입되어 성공적으로 운영되었고, 이후 매년 후계자가 이어 쓸 수 있도록
템플릿화되었습니다.

## 🚀 후계자라면 (시작하기)

**[`HANDOVER/00_개요와_연간_사이클.md`](HANDOVER/00_개요와_연간_사이클.md)** 부터 읽으세요.
그 문서가 전체 안내서의 목차입니다.

빠른 요약:

| 하고 싶은 것 | 문서 |
|---|---|
| 새 시즌 시작 (앱 띄우기) | [HANDOVER/01](HANDOVER/01_연초_셋업.md) |
| 지침·일정·결정 채우기 | [HANDOVER/02](HANDOVER/02_콘텐츠_채우기.md) |
| 당일 역할 페이지 만들기 | [HANDOVER/03](HANDOVER/03_당일역할_페이지.md) |
| 브리핑 덱·현장 보드 제작 | [HANDOVER/04](HANDOVER/04_브리핑_자료_제작.md) · [briefing-build/GUIDE.md](briefing-build/GUIDE.md) |
| 드라이브 연동 | [HANDOVER/05](HANDOVER/05_드라이브_연동.md) |
| 시즌 끝나고 넘기기 | [HANDOVER/06](HANDOVER/06_연말_아카이브와_인수인계.md) |
| 뭔가 깨졌을 때 | [HANDOVER/07](HANDOVER/07_문제해결_FAQ.md) |

## 저장소 지도

```
sportsday-hub/     기획 허브 웹앱 (Next.js 16 · Supabase · Vercel) — README 참조
briefing-build/    브리핑 자료 제작 도구 (pptxgenjs) — GUIDE.md 참조
HANDOVER/          연간 운영 설명서 (후계자용)
archive/           작년 기록: 2026-1/, 2026-2/ (원본 문서·산출물·데이터 사본)
.github/           CI (PR/푸시마다 typecheck·lint·test)
```

## 개발자용 검증

```
cd sportsday-hub
npm run typecheck && npm run lint && npm test && npm run build
```

## 역사

- 2026-2 시즌: `git tag final-2026-2` (종료 시점 스냅샷), 라이브 사이트는 당시 그대로 동결 보존.
- 2026-09 자동화(카톡봇·드라이브싱크봇) 철폐 — 배경은 HANDOVER/07 역사 노트.
