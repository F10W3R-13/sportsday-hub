# sportsday-hub

스포츠데이 기획 통합 웹앱 (Next.js 16 + Supabase + Vercel).
연간 템플릿 — 새 시즌 시작법은 저장소 루트의 **[`HANDOVER/`](../HANDOVER/00_개요와_연간_사이클.md)** 를, 여기는 개발 상세를 다룬다.

## 개발

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:3000)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest run — 데이터 린터 포함 (dayof·dday·parser 등)
npm run build      # 프로덕션 빌드
```

환경변수는 `.env.local.example` 를 `.env.local` 로 복사해 작성 (각 항목 주석에 구하는 법).

## 구조

```
app/                  라우트 — / 대시보드, /timeline, /team/[id], /handoffs,
                      /files, /settings, /trash, /my-role (당일 역할 조회)
lib/
  event-config.ts     ⚙ 연도 설정의 단일 원천 — 새 시즌에 사실상 유일하게 수정하는 파일
  dayof/              당일 페이지: data.ts(배치 데이터)·copy.ts(친절 설명)·schedule.ts(엔진)
  dday.ts             D-데이 계산 (EVENT_DATE_ISO 파생)
  markdown/           content-source 마크다운 → 결정/마일스톤/이슈 파서
  handoff.ts ·        순수 로직 모듈 (테스트 대상)
  milestones-urgency.ts
  supabase/           클라이언트(browser/server/service) + 데모 쓰기차단
  queries/·mutations/ React Query CRUD
components/           UI (shadcn 기반)
scripts/
  migrate-from-md.ts        content-source → 시드 SQL 재생성 (npm run migrate:md)
  update-guideline-doc.ts   지침 문서만 DB 갱신 (--dry-run 지원)
  verify-guideline-sync.ts  원본 문서 폴더와 content-source 정합 검증 (--canonical=)
supabase/
  template/000_baseline_schema.sql  신규 시즌 원샷 스키마 (SQL Editor 붙여넣기)
  migrations/               26-2 시즌의 실제 변경 이력 (데이터 시드 포함 — 과거 기록)
  demo/                     읽기전용 데모 인스턴스용 (DEMO-DEPLOY-GUIDE.md 참조)
tests/                vitest — 로직 + 데이터 린터 (데이터 교체 후 실수를 잡아준다)
```

## 데이터 원천 규칙

| 데이터 | 원천 | 비고 |
|---|---|---|
| 팀 구성·행사명·행사일 | `lib/event-config.ts` | 앱 어디에도 하드코딩하지 않는다 |
| 팀 지침·결정·마일스톤·이슈 | Supabase (웹 UI) | SSOT — 운영 중 수정은 UI에서 |
| 콘텐츠 원본 문서 | `content-source/*.md` | 연초 시드·큰 개정 시 사용 |
| 당일 배치 | `lib/dayof/data.ts` (+ `briefing-build/roster.js`) | 양쪽 수동 동기화 |

## 참고

- 카카오톡 봇(메모·단체방·watchdog)과 드라이브 동기화 봇 등 모든 자동화는
  2026-09-18 전부 폐지됐다 — 구조·이력은 git 히스토리 참조. 재제안 금지.
- 데모 인스턴스 구축법: `docs/DEMO-DEPLOY-GUIDE.md`
- 시급함 분류(`lib/milestones-urgency.ts`)는 앱 대시보드에서 계속 사용한다
