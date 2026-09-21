# sportsday-hub

26-2 스포츠데이 기획 통합 웹앱 (Next.js 16 + Supabase + Vercel).

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest run
```

## 참고

- 카카오톡 봇(메모·단체방·watchdog)과 드라이브 동기화 봇 등 모든 자동화는
  2026-09-18 전부 폐지됐다 — 구조·이력은 git 히스토리 참조.
- 테스트/정합: `supabase/demo/000_setup_demo_all_in_one.sql`이 전체 스키마 시드
- 시급함 분류(`lib/milestones-urgency.ts`)는 앱 대시보드에서 계속 사용한다
