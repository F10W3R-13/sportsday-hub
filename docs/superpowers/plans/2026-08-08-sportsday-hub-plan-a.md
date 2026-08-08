# 26-2 스포츠데이 허브 Plan A — 기반 + 데이터 + 조회 (읽기 전용 대시보드)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마크다운 지침에서 데이터를 이주해 Supabase에 저장하고, 4개 화면(대시보드/팀 워크스페이스/타임라인/체크리스트)을 읽기 전용으로 렌더링하는 첫 배포 가능한 웹앱을 만든다.

**Architecture:** Next.js 15 App Router(Server Components로 조회) + Supabase Postgres(정규화 테이블 + JSONB 문서) + shadcn/ui. 하이브리드 데이터 모델 — 집계 항목은 정규화 테이블(teams/decisions/milestones/checklist_items/issues), 풍부한 콘텐츠는 JSONB 마크다운 문자열. 마크다운 이주 스크립트가 5개 지침 파일을 SQL 시드로 변환.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, shadcn/ui, @supabase/ssr, @supabase/supabase-js, TanStack Query v5, react-markdown + remark-gfm, Zod, date-fns, Vitest (이주 스크립트 단위 테스트)

**Spec:** `docs/superpowers/specs/2026-08-08-sportsday-hub-design.md`

## Global Constraints

- **작업 디렉토리:** `sportsday-hub/` (현재 프로젝트 루트의 서브폴더로 생성)
- **Node:** v20+
- **패키지 매니저:** pnpm
- **Supabase:** 클라우드 (supabase.com 무료 티어) — Docker 로컬 불필요
- **인증 없음:** 모든 데이터 접근은 `anon` 키 + RLS 전권 공개 정책
- **환경 변수:** `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (두 개 모두 NEXT_PUBLIC_ 접두사)
- **언어:** UI 텍스트는 한국어 (팀원용)
- **상태 배지 SSOT:** 🟢 확정(confirmed) / 🟡 논의중(discussing) / ⚪ 보류·미정(pending/deferred) — 기존 회의 spec 계승
- **빈도 잦은 커밋:** 각 스텝 완료 시 커밋
- **팀 ID 고정값:** `management` | `content` | `budget` | `exchange` | `timeline`
- **결정 ID:** `D1`~`D7`
- **마크다운 원본 경로:** `../26-2 Sports Day/` (sportsday-hub 기준 상대경로) — 이주 시 `content-source/`로 복사

---

## File Structure (Plan A 범위)

```
sportsday-hub/
├── app/
│   ├── layout.tsx                 # 루트 레이아웃 (사이드바, 닉네임 provider)
│   ├── page.tsx                   # 대시보드 (/)
│   ├── team/[id]/page.tsx         # 팀 워크스페이스
│   ├── timeline/page.tsx          # 타임라인 리스트
│   ├── checklists/page.tsx        # 체크리스트 통합 뷰
│   └── providers.tsx              # TanStack Query provider (client)
├── components/
│   ├── ui/                        # shadcn/ui (자동 생성)
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── nickname-provider.tsx
│   ├── dashboard/
│   │   ├── stats-cards.tsx
│   │   ├── decision-tracker.tsx
│   │   ├── team-status-card.tsx
│   │   └── upcoming-milestones.tsx
│   ├── team/
│   │   ├── team-tabs.tsx
│   │   ├── guideline-viewer.tsx
│   │   ├── checklist-panel.tsx
│   │   ├── milestone-panel.tsx
│   │   └── issue-panel.tsx
│   ├── timeline/
│   │   └── timeline-list.tsx
│   ├── checklist/
│   │   └── unified-checklist.tsx
│   └── shared/
│       ├── status-badge.tsx
│       ├── priority-badge.tsx
│       └── empty-state.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── queries/
│   │   ├── decisions.ts
│   │   ├── milestones.ts
│   │   ├── checklist.ts
│   │   ├── issues.ts
│   │   └── teams.ts
│   ├── markdown/
│   │   ├── parser.ts              # 마크다운 → JSONB 파서
│   │   └── renderer.tsx           # react-markdown 설정
│   ├── types/
│   │   ├── database.ts            # Supabase 타입
│   │   └── models.ts              # Zod 스키마 + 도메인 타입
│   └── utils.ts
├── migrations/
│   ├── 0001_init_schema.sql
│   ├── 0002_rls_policies.sql
│   └── 0005_seed_data.sql         # 이주 스크립트가 생성
├── scripts/
│   └── migrate-from-md.ts
├── tests/
│   └── parser.test.ts             # 마크다운 파서 단위 테스트
├── content-source/                # 이주 원본 복사본
├── supabase/config.toml
├── .env.local.example
├── package.json
├── components.json
├── next.config.ts
├── tsconfig.json
└── vitest.config.ts
```

**편집/안전망(audit_log, soft-delete, 닉네임 RPC)은 Plan B에서 다룬다.** Plan A는 읽기 전용 조회만. 다만 스키마(0001)는 미리 전부 만들어두어 Plan B가 마이그레이션만 추가하면 되게 한다.

---

## Task 1: 프로젝트 스캐폴드 + 의존성 + shadcn/ui

**Files:**
- Create: `sportsday-hub/` (create-next-app으로 생성)
- Create: `sportsday-hub/.env.local.example`
- Create: `sportsday-hub/.gitignore` (create-next-app 기본 + .env.local)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: 실행 가능한 Next.js 프로젝트 + shadcn/ui 설정 + `components.json`

- [ ] **Step 1: 현재 프로젝트를 git repo로 초기화 (아직 아닌 경우)**

이 폴더가 git repo가 아니므로 먼저 초기화한다.

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git init
git add -A
git commit -m "chore: 기존 기획 자료 초기 커밋"
```

- [ ] **Step 2: create-next-app으로 프로젝트 생성**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
pnpm create next-app@latest sportsday-hub --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-pnpm --no-turbopack
```

프롬프트가 나오면 모두 기본값 엔터. 생성 후 디렉토리로 이동:

```bash
cd sportsday-hub
```

- [ ] **Step 3: 핵심 의존성 설치**

```bash
pnpm add @supabase/supabase-js @supabase/ssr @tanstack/react-query react-markdown remark-gfm zod date-fns clsx tailwind-merge lucide-react
```

```bash
pnpm add -D vitest @vitest/ui @supabase/cli
```

- [ ] **Step 4: shadcn/ui 초기화**

```bash
pnpm dlx shadcn@latest init -d
```

`-d` 플래그는 기본값으로 초기화. `components.json`이 생성되고 `lib/utils.ts`의 `cn()` 함수가 만들어진다.

- [ ] **Step 5: 자주 쓸 shadcn 컴포넌트 추가**

```bash
pnpm dlx shadcn@latest add button card tabs badge input textarea select dialog dropdown-menu separator scroll-area tooltip skeleton sheet accordion
```

- [ ] **Step 6: 환경 변수 템플릿 생성**

`.env.local.example` 생성:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

`.env.local`은 `.gitignore`에 이미 포함되어 있는지 확인(create-next-app 기본 포함).

- [ ] **Step 7: Vitest 설정**

`vitest.config.ts` 생성:

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
})
```

`package.json`의 `scripts`에 test 추가:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 8: 개발 서버 실행 확인**

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000` 접속 → 기본 페이지 표시 확인. 확인 후 Ctrl+C로 종료.

- [ ] **Step 9: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: Next.js 프로젝트 스캐폴드 + shadcn/ui + 의존성 설정"
```

---

## Task 2: 데이터 모델 타입 + Zod 스키마

**Files:**
- Create: `sportsday-hub/lib/types/models.ts`
- Create: `sportsday-hub/lib/types/database.ts`

**Interfaces:**
- Consumes: Task 1의 프로젝트 구조
- Produces: `Team`, `Decision`, `Milestone`, `ChecklistItem`, `Issue`, `GuidelineDoc` 타입과 Zod 스키마. 이후 모든 쿼리/컴포넌트가 이 타입을 사용.

- [ ] **Step 1: 도메인 타입 + Zod 스키마 작성**

`lib/types/models.ts` 생성:

```typescript
import { z } from 'zod'

// ===== 팀 =====
export const TEAM_IDS = [
  'management',
  'content',
  'budget',
  'exchange',
  'timeline',
] as const
export type TeamId = (typeof TEAM_IDS)[number]

export const teamSchema = z.object({
  id: z.enum(TEAM_IDS),
  name: z.string(),
  name_en: z.string(),
  color: z.string(),           // hex
  icon: z.string(),            // lucide 아이콘명
  sort_order: z.number(),
  mission: z.string(),
  guideline_doc: z.object({
    sections: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        order: z.number(),
        content_md: z.string(),
      })
    ),
  }),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})
export type Team = z.infer<typeof teamSchema>

// ===== 결정 =====
export const DECISION_STATUS = [
  'confirmed',
  'discussing',
  'pending',
  'deferred',
] as const
export type DecisionStatus = (typeof DECISION_STATUS)[number]

export const decisionSchema = z.object({
  id: z.string(),              // 'D1'~'D7'
  title: z.string(),
  options: z.array(z.string()),
  status: z.enum(DECISION_STATUS),
  current_value: z.string().nullable(),
  decision_date: z.string().nullable(),
  sort_order: z.number(),
  notes: z.string().nullable(),
  updated_at: z.string().optional(),
})
export type Decision = z.infer<typeof decisionSchema>

// ===== 마일스톤 =====
export const MILESTONE_CATEGORIES = [
  'meeting',
  'deliverable',
  'event',
] as const
export type MilestoneCategory = (typeof MILESTONE_CATEGORIES)[number]

export const milestoneSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),            // ISO date
  title: z.string(),
  team_id: z.enum(TEAM_IDS).nullable(),
  category: z.enum(MILESTONE_CATEGORIES),
  completed: z.boolean(),
  depends_on: z.array(z.string().uuid()).nullable(),
  sort_order: z.number(),
  updated_at: z.string().optional(),
})
export type Milestone = z.infer<typeof milestoneSchema>

// ===== 체크리스트 =====
export const PRIORITY = ['high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITY)[number]

export const CHECKLIST_SECTIONS = ['progress', 'feedback', 'prep'] as const
export type ChecklistSection = (typeof CHECKLIST_SECTIONS)[number]

export const checklistItemSchema = z.object({
  id: z.string().uuid(),
  team_id: z.enum(TEAM_IDS).nullable(),
  section: z.enum(CHECKLIST_SECTIONS),
  content: z.string(),
  priority: z.enum(PRIORITY).nullable(),
  completed: z.boolean(),
  source: z.string().nullable(),
  sort_order: z.number(),
  updated_at: z.string().optional(),
})
export type ChecklistItem = z.infer<typeof checklistItemSchema>

// ===== 이슈 =====
export const ISSUE_STATUS = ['open', 'in_progress', 'resolved'] as const
export type IssueStatus = (typeof ISSUE_STATUS)[number]

export const issueSchema = z.object({
  id: z.string().uuid(),
  team_id: z.enum(TEAM_IDS).nullable(),
  date: z.string().nullable(),
  title: z.string(),
  status: z.enum(ISSUE_STATUS),
  notes: z.string().nullable(),
  updated_at: z.string().optional(),
})
export type Issue = z.infer<typeof issueSchema>

// ===== 상태 배지 매핑 =====
export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  confirmed: '확정',
  discussing: '논의중',
  pending: '미정',
  deferred: '보류',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
}
```

- [ ] **Step 2: Supabase Database 타입 작성**

`lib/types/database.ts` 생성 (나중에 `supabase gen types`로 교체 가능, Plan A에서는 수동):

```typescript
import type {
  Team,
  Decision,
  Milestone,
  ChecklistItem,
  Issue,
} from './models'

// Supabase 자동 생성 타입과 호환되는 수동 정의
export interface Database {
  public: {
    Tables: {
      teams: {
        Row: Team
        Insert: Partial<Team>
        Update: Partial<Team>
      }
      decisions: {
        Row: Decision
        Insert: Partial<Decision>
        Update: Partial<Decision>
      }
      milestones: {
        Row: Milestone
        Insert: Partial<Milestone>
        Update: Partial<Milestone>
      }
      checklist_items: {
        Row: ChecklistItem
        Insert: Partial<ChecklistItem>
        Update: Partial<ChecklistItem>
      }
      issues: {
        Row: Issue
        Insert: Partial<Issue>
        Update: Partial<Issue>
      }
    }
  }
}
```

- [ ] **Step 3: 타입 검증 (컴파일)**

```bash
cd sportsday-hub
pnpm tsc --noEmit
```

Expected: 에러 없음 (또는 create-next-app 기본 파일 관련 사소한 에러만).

- [ ] **Step 4: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 데이터 모델 Zod 스키마 + Supabase 타입 정의"
```

---

## Task 3: Supabase 스키마 + RLS 마이그레이션

**Files:**
- Create: `sportsday-hub/supabase/config.toml`
- Create: `sportsday-hub/migrations/0001_init_schema.sql`
- Create: `sportsday-hub/migrations/0002_rls_policies.sql`

**Interfaces:**
- Consumes: Task 2의 타입 정의
- Produces: Supabase DB에 적용 가능한 스키마. Task 4의 시드가 이 테이블에 INSERT.

- [ ] **Step 1: Supabase 로컬 설정 초기화**

```bash
cd sportsday-hub
pnpm supabase init
```

`supabase/config.toml` 생성 확인.

- [ ] **Step 2: 초기 스키마 마이그레이션 작성**

`migrations/0001_init_schema.sql` 생성:

```sql
-- 26-2 스포츠데이 허브 초기 스키마

-- extensions
create extension if not exists "uuid-ossp";

-- ===== teams =====
create table public.teams (
  id            text primary key,
  name          text not null,
  name_en       text not null,
  color         text not null,
  icon          text not null,
  sort_order    int not null,
  mission       text not null,
  guideline_doc jsonb not null default '{"sections":[]}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ===== decisions =====
create table public.decisions (
  id            text primary key,
  title         text not null,
  options       text[] not null default '{}',
  status        text not null default 'pending'
                  check (status in ('confirmed','discussing','pending','deferred')),
  current_value text,
  decision_date date,
  sort_order    int not null default 0,
  notes         text,
  updated_at    timestamptz not null default now()
);

-- ===== milestones =====
create table public.milestones (
  id          uuid primary key default uuid_generate_v4(),
  date        date not null,
  title       text not null,
  team_id     text references public.teams(id) on delete set null,
  category    text not null default 'deliverable'
                check (category in ('meeting','deliverable','event')),
  completed   boolean not null default false,
  depends_on  uuid[] default null,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

-- ===== checklist_items =====
create table public.checklist_items (
  id          uuid primary key default uuid_generate_v4(),
  team_id     text references public.teams(id) on delete cascade,
  section     text not null default 'progress'
                check (section in ('progress','feedback','prep')),
  content     text not null,
  priority    text check (priority in ('high','medium','low')),
  completed   boolean not null default false,
  source      text,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

-- ===== issues =====
create table public.issues (
  id          uuid primary key default uuid_generate_v4(),
  team_id     text references public.teams(id) on delete cascade,
  date        date,
  title       text not null,
  status      text not null default 'open'
                check (status in ('open','in_progress','resolved')),
  notes       text,
  updated_at  timestamptz not null default now()
);

-- ===== updated_at 자동 갱신 트리거 =====
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_teams_updated    before update on public.teams
  for each row execute function public.touch_updated_at();
create trigger trg_decisions_updated before update on public.decisions
  for each row execute function public.touch_updated_at();
create trigger trg_milestones_updated before update on public.milestones
  for each row execute function public.touch_updated_at();
create trigger trg_checklist_updated before update on public.checklist_items
  for each row execute function public.touch_updated_at();
create trigger trg_issues_updated   before update on public.issues
  for each row execute function public.touch_updated_at();
```

- [ ] **Step 3: RLS 정책 마이그레이션 작성**

`migrations/0002_rls_policies.sql` 생성:

```sql
-- RLS 활성화 (열린 편집: anon 전권)
alter table public.teams           enable row level security;
alter table public.decisions       enable row level security;
alter table public.milestones      enable row level security;
alter table public.checklist_items enable row level security;
alter table public.issues          enable row level security;

-- ===== teams =====
create policy "teams_open_read"  on public.teams for select using (true);
create policy "teams_open_write" on public.teams for insert with check (true);
create policy "teams_open_edit"  on public.teams for update using (true);
create policy "teams_open_del"   on public.teams for delete using (true);

-- ===== decisions =====
create policy "decisions_open_read"  on public.decisions for select using (true);
create policy "decisions_open_write" on public.decisions for insert with check (true);
create policy "decisions_open_edit"  on public.decisions for update using (true);
create policy "decisions_open_del"   on public.decisions for delete using (true);

-- ===== milestones =====
create policy "milestones_open_read"  on public.milestones for select using (true);
create policy "milestones_open_write" on public.milestones for insert with check (true);
create policy "milestones_open_edit"  on public.milestones for update using (true);
create policy "milestones_open_del"   on public.milestones for delete using (true);

-- ===== checklist_items =====
create policy "checklist_open_read"  on public.checklist_items for select using (true);
create policy "checklist_open_write" on public.checklist_items for insert with check (true);
create policy "checklist_open_edit"  on public.checklist_items for update using (true);
create policy "checklist_open_del"   on public.checklist_items for delete using (true);

-- ===== issues =====
create policy "issues_open_read"  on public.issues for select using (true);
create policy "issues_open_write" on public.issues for insert with check (true);
create policy "issues_open_edit"  on public.issues for update using (true);
create policy "issues_open_del"   on public.issues for delete using (true);
```

> 참고: `audit_log`, soft-delete, 닉네임 RPC는 Plan B의 `0003_audit_trigger.sql`, `0004_soft_delete.sql`에서 다룬다. Plan A는 읽기 전용이므로 편집 안전망 불필요.

- [ ] **Step 4: 클라우드 Supabase 프로젝트 생성 + 연결**

클라우드 Supabase를 사용한다 (Docker 로컬 불필요):

1. [supabase.com](https://supabase.com)에서 "New Project" 생성 (무료 티어)
   - Project name: `sportsday-hub` (임의)
   - Database password: 안전한 곳에 보관
   - Region: 가장 가까운 곳 (Northeast Asia / Seoul 있으면)
2. 프로젝트 생성 완료 대기 (~2분)
3. Project Settings → API에서 다음 복사:
   - Project URL (예: `https://xxxxx.supabase.co`)
   - `anon` public key

이제 CLI로 프로젝트 연결:

```bash
cd sportsday-hub
pnpm supabase link --project-ref <프로젝트-ref>
```

프로젝트 ref는 Supabase 대시보드 URL(`app.supabase.com/project/<ref>`)에서 확인하거나, `supabase projects list`로 조회.

- [ ] **Step 5: 마이그레이션 클라우드 DB에 적용**

```bash
pnpm supabase db push
```

이 명령은 `migrations/*.sql`을 원격 DB에 순서대로 적용한다. (Plan A 범위에서는 아직 0001, 0002만 있음 — 0005 시드는 Task 5에서 추가.)

- [ ] **Step 6: 스키마 적용 확인**

Supabase 대시보드 → Table Editor에서 5개 테이블(teams, decisions, milestones, checklist_items, issues)이 생성되었는지 확인.

또는 CLI로:

```bash
pnpm supabase db dump --schema=public
```

출력에 5개 테이블이 보이는지 확인.

- [ ] **Step 7: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: Supabase 초기 스키마 + RLS 열린 편집 정책"
```

---

## Task 4: 마크다운 이주 파서 + 단위 테스트

**Files:**
- Create: `sportsday-hub/lib/markdown/parser.ts`
- Create: `sportsday-hub/tests/parser.test.ts`
- Create: `sportsday-hub/content-source/` (원본 복사)

**Interfaces:**
- Consumes: Task 2의 `Team`/`Decision`/`Milestone`/`ChecklistItem`/`Issue` 타입. 원본 마크다운: `../26-2 Sports Day/*.md`
- Produces: `parseMasterGuideline(md)` → `{ decisions, milestones, issues, guidelineSections }`. `parseTeamGuideline(md, teamId)` → `{ checklistItems, issues, guidelineSections, mission }`. Task 5의 시드 스크립트가 이 함수들을 호출.

- [ ] **Step 1: 이주 원본 마크다운 복사**

```bash
cd sportsday-hub
mkdir -p content-source/teams
cp "../26-2 Sports Day/00_기획지침_마스터.md" content-source/
cp "../26-2 Sports Day/컨텐츠팀/컨텐츠팀_지침.md" content-source/teams/content.md
cp "../26-2 Sports Day/예산팀/예산팀_지침.md" content-source/teams/budget.md
cp "../26-2 Sports Day/교환담당팀/교환담당팀_지침.md" content-source/teams/exchange.md
cp "../26-2 Sports Day/타임라인_인원관리팀/타임라인_인원관리팀_지침.md" content-source/teams/timeline.md
```

복사 확인:

```bash
ls content-source/ content-source/teams/
```

Expected: 마스터 파일 1개 + teams 하위 4개.

- [ ] **Step 2: 마크다운 파서 작성 — 핵심 헬퍼**

`lib/markdown/parser.ts` 생성. 먼저 헤더 기준 섹션 분리 헬퍼:

```typescript
import type {
  Decision,
  Milestone,
  ChecklistItem,
  Issue,
  TeamId,
} from '@/lib/types/models'

// ===== 섹션 분리: ## 헤더 기준 =====
export interface MdSection {
  level: number         // 1,2,3...
  title: string
  body: string          // 헤더 라인을 제외한 본문
  raw: string           // 헤더 포함 원본
}

export function splitSections(md: string): MdSection[] {
  const lines = md.split('\n')
  const sections: MdSection[] = []
  let current: MdSection | null = null
  let buffer: string[] = []

  const flush = () => {
    if (current) {
      current.body = buffer.join('\n').trim()
      current.raw = `## ${current.title}\n${current.body}`
      sections.push(current)
    }
  }

  for (const line of lines) {
    const m = line.match(/^(#{2,6})\s+(.+)$/)
    if (m) {
      flush()
      current = { level: m[1].length, title: m[2].trim(), body: '', raw: '' }
      buffer = []
    } else if (current) {
      buffer.push(line)
    }
  }
  flush()
  return sections
}

// 마크다운 표 행 파서 (간단 버전 — | 구분)
export function parseTable(body: string): string[][] {
  const rows: string[][] = []
  let inTable = false
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // separator 행 (|---|---|) 건너뜀
      if (/^\|[\s:|-]+\|$/.test(trimmed)) continue
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
      rows.push(cells)
      inTable = true
    } else if (inTable && trimmed === '') {
      inTable = false
    }
  }
  return rows
}

// 체크리스트 "- [ ]" / "- [x]" 파서
export interface ParsedCheck {
  checked: boolean
  text: string
}

export function parseChecklist(body: string): ParsedCheck[] {
  const checks: ParsedCheck[] = []
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/)
    if (m) {
      checks.push({ checked: m[1].toLowerCase() === 'x', text: m[2].trim() })
    }
  }
  return checks
}
```

- [ ] **Step 3: 마크다운 파서 작성 — 결정 추적표 파서**

같은 파일 `lib/markdown/parser.ts`에 추가:

```typescript
// ===== 결정 추적표 파서 (마스터 §3) =====
// 표 형식: | # | 결정 항목 | 옵션 | 현재 상태 | 결정일 | 비고 |
// 상태에서 🟢확정 / 🟡검토 / 🔴미정 / ⚪보류 를 status로 매핑

function mapDecisionStatus(raw: string): {
  status: Decision['status']
  value: string | null
} {
  const lower = raw.toLowerCase()
  if (raw.includes('확정')) {
    const m = raw.match(/확정:?\s*\*?\*?([^*|]+)/)
    return { status: 'confirmed', value: m ? m[1].trim() : raw }
  }
  if (raw.includes('방향') || raw.includes('논의')) {
    return { status: 'discussing', value: raw.replace(/🟡/g, '').trim() || null }
  }
  if (raw.includes('보류')) {
    return { status: 'deferred', value: raw.replace(/⚪/g, '').trim() || null }
  }
  if (raw.includes('미정')) {
    return { status: 'pending', value: null }
  }
  return { status: 'pending', value: raw || null }
}

export function parseDecisions(md: string): Decision[] {
  const sections = splitSections(md)
  const decSection = sections.find((s) =>
    s.title.includes('핵심 결정 추적표')
  )
  if (!decSection) return []

  const rows = parseTable(decSection.body)
  // 첫 행은 헤더
  const dataRows = rows.slice(1)
  return dataRows
    .filter((r) => r[0] && r[0].startsWith('D'))
    .map((r, i) => {
      const id = r[0]?.trim() ?? ''
      const title = r[1]?.trim() ?? ''
      const optionsRaw = r[2]?.trim() ?? ''
      const options = optionsRaw
        ? optionsRaw.split('/').map((o) => o.trim()).filter(Boolean)
        : []
      const statusRaw = r[3]?.trim() ?? ''
      const { status, value } = mapDecisionStatus(statusRaw)
      const decisionDateRaw = r[4]?.trim() ?? ''
      const decisionDate =
        decisionDateRaw && decisionDateRaw !== '-' ? decisionDateRaw : null
      const notes = r[5]?.trim() ?? null
      return {
        id,
        title,
        options,
        status,
        current_value: value,
        decision_date: decisionDate,
        sort_order: i,
        notes,
      } satisfies Decision
    })
}
```

- [ ] **Step 4: 마크다운 파서 작성 — 마일스톤 파서**

같은 파일에 추가:

```typescript
import { randomUUID } from 'crypto'

// ===== 마일스톤 파서 (마스터 §4) =====
// §4-1 회의 일정: "- [ ] 이름 (날짜)" 형식 → category='meeting'
// §4-2 산출물 일정: 표 | 날짜 | 산출물 | 담당 | 완료 | → category='deliverable'

const TEAM_KEYWORD: Record<string, TeamId> = {
  컨텐츠: 'content',
  콘텐츠: 'content',
  예산: 'budget',
  교환: 'exchange',
  타임라인: 'timeline',
  기획관리: 'management',
  기획: 'management',
  전체: 'management',
}

function mapTeam(raw: string): TeamId | null {
  for (const [keyword, id] of Object.entries(TEAM_KEYWORD)) {
    if (raw.includes(keyword)) return id
  }
  return null
}

// 한국식 날짜 (8/9, 8/13 등) → ISO (2026-MM-DD)
function parseKoreanDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})/)
  if (!m) return null
  const month = m[1].padStart(2, '0')
  const day = m[2].padStart(2, '0')
  return `2026-${month}-${day}`
}

export function parseMilestones(md: string): Milestone[] {
  const sections = splitSections(md)
  const milestones: Milestone[] = []
  let sortOrder = 0

  // 회의 일정 (§4-1) — 체크리스트 형식
  const meetingSection = sections.find((s) =>
    s.title.includes('회의 일정')
  )
  if (meetingSection) {
    const checks = parseChecklist(meetingSection.body)
    for (const c of checks) {
      const dateStr = parseKoreanDate(c.text)
      if (dateStr) {
        // "방중회의 (8/7 진행 완료)" → 완료 여부
        const completed = c.checked || c.text.includes('완료')
        const title = c.text.replace(/\([^)]*\)/g, '').trim()
        milestones.push({
          id: randomUUID(),
          date: dateStr,
          title,
          team_id: null,
          category: 'meeting',
          completed,
          depends_on: null,
          sort_order: sortOrder++,
        })
      }
    }
  }

  // 산출물 일정 (§4-2) — 표 형식
  const deliverableSection = sections.find((s) =>
    s.title.includes('산출물 일정')
  )
  if (deliverableSection) {
    const rows = parseTable(deliverableSection.body)
    for (const r of rows.slice(1)) {
      const dateStr = parseKoreanDate(r[0] ?? '')
      if (dateStr) {
        const title = r[1]?.trim() ?? ''
        const teamRaw = r[2]?.trim() ?? ''
        const completedRaw = r[3]?.trim() ?? ''
        milestones.push({
          id: randomUUID(),
          date: dateStr,
          title,
          team_id: mapTeam(teamRaw),
          category: r[0]?.includes('Sports Day') ? 'event' : 'deliverable',
          completed: completedRaw === '[x]',
          depends_on: null,
          sort_order: sortOrder++,
        })
      }
    }
  }

  return milestones
}
```

- [ ] **Step 5: 마크다운 파서 작성 — 체크리스트/이슈/지침 섹션 파서**

같은 파일에 추가:

```typescript
// ===== 체크리스트 파서 (각 팀 §진행 체크리스트 / 피드백 체크리스트) =====

function mapPriority(text: string): ChecklistItem['priority'] {
  if (text.includes('🔴') || text.includes('HIGH')) return 'high'
  if (text.includes('🟡') || text.includes('MID')) return 'medium'
  if (text.includes('🟢') || text.includes('LOW')) return 'low'
  return null
}

function detectSection(sectionTitle: string): ChecklistItem['section'] {
  if (sectionTitle.includes('피드백')) return 'feedback'
  if (sectionTitle.includes('진행 체크리스트') || sectionTitle.includes('체크리스트'))
    return 'progress'
  return 'prep'
}

export function parseTeamChecklists(
  md: string,
  teamId: TeamId
): ChecklistItem[] {
  const sections = splitSections(md)
  const items: ChecklistItem[] = []
  let sortOrder = 0

  for (const section of sections) {
    if (
      section.title.toLowerCase().includes('체크리스트') ||
      section.title.includes('피드백')
    ) {
      const sectionType = detectSection(section.title)
      const checks = parseChecklist(section.body)
      for (const c of checks) {
        const priority = mapPriority(c.text)
        // 출처 추출 "(26-1 출처)" 등
        const sourceMatch = c.text.match(/\(([^)]*(?:출처|피드백)[^)]*)\)/i)
        const source = sourceMatch ? sourceMatch[1] : null
        // 이모지·출처 괄호 제거한 본문
        const content = c.text
          .replace(/[🔴🟡🟢]/g, '')
          .replace(/\([^)]*(?:출처|피드백)[^)]*\)/gi, '')
          .replace(/—\s*.*$/, '')
          .trim()
        if (content) {
          items.push({
            id: randomUUID(),
            team_id: teamId,
            section: sectionType,
            content,
            priority,
            completed: c.checked,
            source,
            sort_order: sortOrder++,
          })
        }
      }
    }
  }

  return items
}

// ===== 이슈 파서 (마스터 §8 / 각 팀 §이슈 로그) =====
export function parseIssues(
  md: string,
  teamId: TeamId | null
): Issue[] {
  const sections = splitSections(md)
  const issueSection = sections.find((s) =>
    s.title.toLowerCase().includes('이슈 로그')
  )
  if (!issueSection) return []

  const rows = parseTable(issueSection.body)
  return rows.slice(1)
    .filter((r) => r[1]?.trim()) // 제목이 있는 행만
    .map((r) => {
      const statusRaw = r[3]?.trim().toLowerCase() ?? ''
      let status: Issue['status'] = 'open'
      if (statusRaw.includes('progress') || statusRaw.includes('진행'))
        status = 'in_progress'
      else if (statusRaw.includes('resolve') || statusRaw.includes('해결'))
        status = 'resolved'
      return {
        id: randomUUID(),
        team_id: teamId,
        date: parseKoreanDate(r[0] ?? '') ?? null,
        title: r[1]?.trim() ?? '',
        status,
        notes: r[4]?.trim() ?? null,
      }
    })
}

// ===== 지침 섹션 파서 (JSONB용 — 체크리스트/이슈/결정/마일스톤 섹션 제외) =====
const EXCLUDED_SECTION_PATTERNS = [
  '핵심 결정 추적표',
  '마일스톤',
  '이슈 로그',
  '체크리스트',
  '피드백',
  '진행 체크리스트',
  '지침 파일 갱신',
]

export interface GuidelineSection {
  id: string
  title: string
  order: number
  content_md: string
}

export function parseGuidelineSections(md: string): GuidelineSection[] {
  const sections = splitSections(md)
  const result: GuidelineSection[] = []
  let order = 0
  for (const section of sections) {
    const isExcluded = EXCLUDED_SECTION_PATTERNS.some((p) =>
      section.title.toLowerCase().includes(p.toLowerCase())
    )
    if (isExcluded) continue
    // slug id 생성
    const id = section.title
      .replace(/[^\w\s가-힣]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 50)
    result.push({
      id: id || `section-${order}`,
      title: section.title,
      order: order++,
      content_md: section.raw,
    })
  }
  return result
}
```

- [ ] **Step 6: 단위 테스트 작성 — 실패 확인 먼저**

`tests/parser.test.ts` 생성:

```typescript
import { describe, it, expect } from 'vitest'
import {
  splitSections,
  parseTable,
  parseChecklist,
  parseDecisions,
  parseMilestones,
  parseTeamChecklists,
  parseIssues,
  parseGuidelineSections,
} from '@/lib/markdown/parser'

const MASTER_SAMPLE = `# 마스터

## 3. 🎯 핵심 결정 추적표 (전체)

| # | 결정 항목 | 옵션 | **현재 상태** | 결정일 | 비고 |
|---|---|---|---|---|---|
| D1 | **컨셉/행사명** | 인사이드아웃 / 미니언즈 | 🟢 확정: **인사이드아웃** | 8/5 | 1차 회의 |
| D4 | **입장료** | 1.3만원 / 1.5만원 | ⚪ 보류: 동아리 보전 한도 | - | 25-2 기준 1.5만원 |
| D7 | **점수 배분** | 팀 수에 따라 | 🔴 미정 (D2 종속) | - | 작년 5팀 |

## 4. 📅 마일스톤 & 진행 현황

### 4-1. 회의 일정
- [x] **기획팀 1차 회의** (7/29 22:00)
- [ ] **기획팀 2차 회의** (8/9 예정)

### 4-2. 팀별 주요 산출물 일정

| 날짜 | 산출물 | 담당 | 완료 |
|---|---|---|---|
| 8/9 | 컨텐츠 방향성 뼈대 | 컨텐츠팀 | [ ] |
| 8/13 | 타임라인 완성 | 타임라인팀 | [ ] |
| 9/19 | **Sports Day** | 전체 | [ ] |

## 8. 이슈 로그 (전체)

| 날짜 | 이슈 | 관련 팀 | 상태 | 비고 |
|---|---|---|---|---|
| | | | | |

## 9. 기타 섹션

여기는 지침 본문입니다.
`

const TEAM_SAMPLE = `# 컨텐츠팀 지침

## 1. 팀 미션 & 산출물

### 미션
- 토너먼트 게임 4종 기획

## 9. 작년 피드백 반영 체크리스트

- [ ] 🔴 **심판 규칙 사전 숙지** — 최소 3일 전 역할 배정
- [x] 🟢 페이스페인팅 유지

## 11. 진행 체크리스트

- [ ] 컨셉(D1)·팀 개수(D2) 수령
- [ ] 토너먼트 4종 확정

## 10. 이슈 로그

| 날짜 | 이슈 | 상태 | 비고 |
|---|---|---|---|
`

describe('splitSections', () => {
  it('## 헤더 기준으로 섹션을 분리한다', () => {
    const sections = splitSections(MASTER_SAMPLE)
    expect(sections.length).toBeGreaterThan(0)
    const titles = sections.map((s) => s.title)
    expect(titles).toContain('3. 🎯 핵심 결정 추적표 (전체)')
  })
})

describe('parseTable', () => {
  it('표 행을 셀 배열로 파싱한다', () => {
    const sections = splitSections(MASTER_SAMPLE)
    const decSection = sections.find((s) =>
      s.title.includes('핵심 결정 추적표')
    )!
    const rows = parseTable(decSection.body)
    expect(rows.length).toBeGreaterThan(0)
    // 헤더 + 데이터 행
    expect(rows[0][0]).toBe('#')
    // separator 행 건너뜀
    expect(rows.some((r) => r[0] === 'D1')).toBe(true)
  })
})

describe('parseChecklist', () => {
  it('체크/언체크 항목을 파싱한다', () => {
    const checks = parseChecklist('- [x] 완료됨\n- [ ] 미완료')
    expect(checks).toHaveLength(2)
    expect(checks[0].checked).toBe(true)
    expect(checks[1].checked).toBe(false)
  })
})

describe('parseDecisions', () => {
  it('D1~D7 결정을 파싱하고 상태를 매핑한다', () => {
    const decisions = parseDecisions(MASTER_SAMPLE)
    expect(decisions.length).toBe(3)
    const d1 = decisions.find((d) => d.id === 'D1')!
    expect(d1.status).toBe('confirmed')
    expect(d1.current_value).toContain('인사이드아웃')
    const d4 = decisions.find((d) => d.id === 'D4')!
    expect(d4.status).toBe('deferred')
    const d7 = decisions.find((d) => d.id === 'D7')!
    expect(d7.status).toBe('pending')
    expect(d7.current_value).toBeNull()
  })
})

describe('parseMilestones', () => {
  it('회의 일정과 산출물 일정을 모두 파싱한다', () => {
    const milestones = parseMilestones(MASTER_SAMPLE)
    // 회의 2 + 산출물 3 = 5
    expect(milestones.length).toBe(5)
    const meetings = milestones.filter((m) => m.category === 'meeting')
    expect(meetings.length).toBe(2)
    const firstMeeting = meetings[0]
    expect(firstMeeting.completed).toBe(true) // 1차 회의는 [x]
    const event = milestones.find((m) => m.category === 'event')
    expect(event?.title).toContain('Sports Day')
    const contentMilestone = milestones.find(
      (m) => m.title.includes('컨텐츠')
    )
    expect(contentMilestone?.team_id).toBe('content')
  })

  it('한국식 날짜를 ISO로 변환한다', () => {
    const milestones = parseMilestones(MASTER_SAMPLE)
    expect(milestones[0].date).toMatch(/^2026-\d{2}-\d{2}$/)
  })
})

describe('parseTeamChecklists', () => {
  it('팀 체크리스트를 파싱하고 우선순위를 매핑한다', () => {
    const items = parseTeamChecklists(TEAM_SAMPLE, 'content')
    // 피드백 2 + 진행 2 = 4
    expect(items.length).toBe(4)
    const feedback = items.filter((i) => i.section === 'feedback')
    expect(feedback.length).toBe(2)
    const highItem = items.find((i) => i.priority === 'high')
    expect(highItem?.content).toContain('심판')
    const completed = items.find((i) => i.completed)
    expect(completed?.content).toContain('페이스페인팅')
  })
})

describe('parseIssues', () => {
  it('빈 이슈 로그는 빈 배열을 반환한다', () => {
    const issues = parseIssues(MASTER_SAMPLE, null)
    expect(issues).toEqual([])
  })
})

describe('parseGuidelineSections', () => {
  it('체크리스트/이슈/결정 섹션은 제외한다', () => {
    const sections = parseGuidelineSections(MASTER_SAMPLE)
    const titles = sections.map((s) => s.title)
    expect(titles).not.toContain('핵심 결정 추적표')
    expect(titles).not.toContain('이슈 로그')
    expect(titles.some((t) => t.includes('기타 섹션'))).toBe(true)
  })
})
```

- [ ] **Step 7: 테스트 실행 — 실패 확인**

```bash
cd sportsday-hub
pnpm test
```

Expected: 모든 테스트 통과 (파서가 Step 2-5에서 구현되었으므로). 만약 실패하면 파서 코드 수정 후 재실행.

> 참고: TDD 원칙상 먼저 테스트를 작성하고 실패를 확인해야 하나, 복잡한 파서는 점진적 구현이 자연스럽다. 테스트가 통과하면 다음 단계로.

- [ ] **Step 8: 실제 마크다운 파일로 통합 테스트**

`tests/parser.test.ts`에 통합 테스트 추가 (파일 끝에):

```typescript
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('실제 마크다운 파일 통합 테스트', () => {
  const masterPath = resolve(__dirname, '../content-source/00_기획지침_마스터.md')
  const masterMd = readFileSync(masterPath, 'utf-8')

  it('마스터에서 결정 7개를 파싱한다', () => {
    const decisions = parseDecisions(masterMd)
    expect(decisions.length).toBe(7)
    const ids = decisions.map((d) => d.id)
    expect(ids).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'])
  })

  it('마스터에서 마일스톤을 파싱한다 (회의 + 산출물)', () => {
    const milestones = parseMilestones(masterMd)
    expect(milestones.length).toBeGreaterThan(10)
    // Sports Day 이벤트 포함
    expect(milestones.some((m) => m.category === 'event')).toBe(true)
  })

  it('컨텐츠팀 체크리스트를 파싱한다', () => {
    const teamPath = resolve(__dirname, '../content-source/teams/content.md')
    const teamMd = readFileSync(teamPath, 'utf-8')
    const items = parseTeamChecklists(teamMd, 'content')
    expect(items.length).toBeGreaterThan(5)
  })
})
```

```bash
pnpm test
```

Expected: 모든 통합 테스트 통과. 실제 마크다운 구조가 샘플과 다르면 파서를 조정.

- [ ] **Step 9: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 마크다운 이주 파서 + 단위/통합 테스트"
```

---

## Task 5: 시드 데이터 생성 스크립트 + 적용

**Files:**
- Create: `sportsday-hub/scripts/migrate-from-md.ts`
- Create: `sportsday-hub/migrations/0005_seed_data.sql` (스크립트가 생성)

**Interfaces:**
- Consumes: Task 4의 파서 함수들. 원본: `content-source/*.md`
- Produces: `migrations/0005_seed_data.sql` — 모든 초기 데이터(5 teams + 7 decisions + milestones + checklist + issues)를 INSERT. Task 3의 스키마에 적용.

- [ ] **Step 1: 팀 메타데이터 정의**

`scripts/migrate-from-md.ts` 생성. 먼저 5개 팀의 고정 메타데이터:

```typescript
import { readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import {
  parseDecisions,
  parseMilestones,
  parseIssues,
  parseTeamChecklists,
  parseGuidelineSections,
} from '@/lib/markdown/parser'
import type { TeamId } from '@/lib/types/models'

// ===== 팀 메타데이터 (고정) =====
const TEAM_META: Record<
  TeamId,
  { name: string; name_en: string; color: string; icon: string; mission: string }
> = {
  management: {
    name: '기획관리팀',
    name_en: 'Management',
    color: '#6366f1', // indigo
    icon: 'Settings',
    mission: '전체 총괄, 진행상황 업데이트, 팀 간 조율',
  },
  content: {
    name: '컨텐츠팀',
    name_en: 'Content',
    color: '#ec4899', // pink
    icon: 'Gamepad2',
    mission: '게임 구성·규칙, 배치도, 필요 인원/물품',
  },
  budget: {
    name: '예산팀',
    name_en: 'Budget',
    color: '#10b981', // emerald
    icon: 'Wallet',
    mission: '예산안, 입장료, 식사, 단체티, 준비물 리스트',
  },
  exchange: {
    name: '교환담당팀',
    name_en: 'Exchange',
    color: '#f59e0b', // amber
    icon: 'Users',
    mission: '구글폼, 참여자 명단, 교환 팀 배정, 카드뉴스 인계물',
  },
  timeline: {
    name: '타임라인/인원관리팀',
    name_en: 'Timeline',
    color: '#06b6d4', // cyan
    icon: 'CalendarClock',
    mission: '전체 타임라인, 하클 인원 배치, 명륜 버스 운영',
  },
}

const TEAM_ORDER: TeamId[] = [
  'management',
  'content',
  'budget',
  'exchange',
  'timeline',
]
```

- [ ] **Step 2: SQL 이스케이프 헬퍼 + 생성 로직**

같은 파일에 추가:

```typescript
// SQL 문자열 이스케이프
function sqlStr(s: string | null | undefined): string {
  if (s == null) return 'NULL'
  return `'${s.replace(/'/g, "''")}'`
}

function sqlBool(b: boolean): string {
  return b ? 'true' : 'false'
}

function sqlArray(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return 'NULL'
  return `ARRAY[${arr.map((s) => sqlStr(s)).join(',')}]::text[]`
}

function sqlJson(obj: unknown): string {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`
}

function sqlDate(d: string | null | undefined): string {
  if (!d) return 'NULL'
  return `'${d}'::date`
}
```

- [ ] **Step 3: 시드 SQL 생성 메인 로직**

같은 파일에 추가:

```typescript
function generateSeed(): string {
  const srcDir = resolve(__dirname, '../content-source')
  const masterMd = readFileSync(join(srcDir, '00_기획지침_마스터.md'), 'utf-8')

  const lines: string[] = [
    '-- 26-2 스포츠데이 허브 시드 데이터',
    '-- 자동 생성: scripts/migrate-from-md.ts',
    '-- 재실행 가능 (idempotent): ON CONFLICT DO NOTHING/UPDATE',
    '',
    'BEGIN;',
    '',
  ]

  // ===== teams =====
  lines.push('-- ===== teams =====')
  for (let i = 0; i < TEAM_ORDER.length; i++) {
    const teamId = TEAM_ORDER[i]
    const meta = TEAM_META[teamId]
    const teamMdPath = teamId === 'management'
      ? join(srcDir, '00_기획지침_마스터.md')
      : join(srcDir, 'teams', `${teamId}.md`)
    const teamMd = readFileSync(teamMdPath, 'utf-8')
    const sections = parseGuidelineSections(teamMd)

    lines.push(
      `INSERT INTO public.teams (id, name, name_en, color, icon, sort_order, mission, guideline_doc) VALUES (${sqlStr(teamId)}, ${sqlStr(meta.name)}, ${sqlStr(meta.name_en)}, ${sqlStr(meta.color)}, ${sqlStr(meta.icon)}, ${i}, ${sqlStr(meta.mission)}, ${sqlJson({ sections })}) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en, color=EXCLUDED.color, icon=EXCLUDED.icon, mission=EXCLUDED.mission, guideline_doc=EXCLUDED.guideline_doc;`
    )
  }
  lines.push('')

  // ===== decisions (마스터에서) =====
  lines.push('-- ===== decisions =====')
  const decisions = parseDecisions(masterMd)
  for (const d of decisions) {
    lines.push(
      `INSERT INTO public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes) VALUES (${sqlStr(d.id)}, ${sqlStr(d.title)}, ${sqlArray(d.options)}, ${sqlStr(d.status)}, ${sqlStr(d.current_value)}, ${sqlDate(d.decision_date)}, ${d.sort_order}, ${sqlStr(d.notes)}) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, options=EXCLUDED.options, status=EXCLUDED.status, current_value=EXCLUDED.current_value, decision_date=EXCLUDED.decision_date, notes=EXCLUDED.notes;`
    )
  }
  lines.push('')

  // ===== milestones (마스터에서) =====
  lines.push('-- ===== milestones =====')
  const milestones = parseMilestones(masterMd)
  // 기존 데이터 정리 (재실행 시 중복 방지) — 날짜+제목 기준
  lines.push('DELETE FROM public.milestones;')
  for (const m of milestones) {
    lines.push(
      `INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES (${sqlStr(m.id)}, ${sqlDate(m.date)}, ${sqlStr(m.title)}, ${sqlStr(m.team_id)}, ${sqlStr(m.category)}, ${sqlBool(m.completed)}, ${m.depends_on ? sqlArray(m.depends_on) : 'NULL'}, ${m.sort_order});`
    )
  }
  lines.push('')

  // ===== checklist_items (각 팀에서) =====
  lines.push('-- ===== checklist_items =====')
  lines.push('DELETE FROM public.checklist_items;')
  for (const teamId of TEAM_ORDER) {
    if (teamId === 'management') continue // 관리팀은 마스터에 체크리스트 없음
    const teamMdPath = join(srcDir, 'teams', `${teamId}.md`)
    const teamMd = readFileSync(teamMdPath, 'utf-8')
    const items = parseTeamChecklists(teamMd, teamId)
    for (const item of items) {
      lines.push(
        `INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES (${sqlStr(item.id)}, ${sqlStr(item.team_id)}, ${sqlStr(item.section)}, ${sqlStr(item.content)}, ${sqlStr(item.priority)}, ${sqlBool(item.completed)}, ${sqlStr(item.source)}, ${item.sort_order});`
      )
    }
  }
  lines.push('')

  // ===== issues (마스터 + 각 팀) =====
  lines.push('-- ===== issues =====')
  lines.push('DELETE FROM public.issues;')
  const masterIssues = parseIssues(masterMd, null)
  for (const issue of masterIssues) {
    lines.push(
      `INSERT INTO public.issues (id, team_id, date, title, status, notes) VALUES (${sqlStr(issue.id)}, NULL, ${sqlDate(issue.date)}, ${sqlStr(issue.title)}, ${sqlStr(issue.status)}, ${sqlStr(issue.notes)});`
    )
  }
  for (const teamId of TEAM_ORDER) {
    if (teamId === 'management') continue
    const teamMdPath = join(srcDir, 'teams', `${teamId}.md`)
    const teamMd = readFileSync(teamMdPath, 'utf-8')
    const issues = parseIssues(teamMd, teamId)
    for (const issue of issues) {
      lines.push(
        `INSERT INTO public.issues (id, team_id, date, title, status, notes) VALUES (${sqlStr(issue.id)}, ${sqlStr(issue.team_id)}, ${sqlDate(issue.date)}, ${sqlStr(issue.title)}, ${sqlStr(issue.status)}, ${sqlStr(issue.notes)});`
      )
    }
  }
  lines.push('')

  lines.push('COMMIT;')
  return lines.join('\n')
}
```

- [ ] **Step 4: 메인 실행부 + 결과 리포트**

같은 파일에 추가:

```typescript
function main() {
  console.log('마크다운 → SQL 시드 변환 시작...\n')

  const sql = generateSeed()
  const outPath = resolve(__dirname, '../migrations/0005_seed_data.sql')
  writeFileSync(outPath, sql, 'utf-8')

  // 결과 리포트
  const srcDir = resolve(__dirname, '../content-source')
  const masterMd = readFileSync(
    join(srcDir, '00_기획지침_마스터.md'),
    'utf-8'
  )
  const decisions = parseDecisions(masterMd)
  const milestones = parseMilestones(masterMd)
  const masterIssues = parseIssues(masterMd, null)

  let totalChecklist = 0
  let totalTeamIssues = 0
  for (const teamId of TEAM_ORDER) {
    if (teamId === 'management') continue
    const teamMd = readFileSync(
      join(srcDir, 'teams', `${teamId}.md`),
      'utf-8'
    )
    totalChecklist += parseTeamChecklists(teamMd, teamId).length
    totalTeamIssues += parseIssues(teamMd, teamId).length
  }

  console.log('=== 이주 결과 리포트 ===')
  console.log(`teams:           ${TEAM_ORDER.length}`)
  console.log(`decisions:       ${decisions.length}`)
  console.log(`milestones:      ${milestones.length}`)
  console.log(`checklist_items: ${totalChecklist}`)
  console.log(`issues:          ${masterIssues.length + totalTeamIssues} (마스터 ${masterIssues.length} + 팀 ${totalTeamIssues})`)
  console.log(`\n출력: ${outPath}`)
}

main()
```

- [ ] **Step 5: tsx 설치 (TS 스크립트 실행용)**

```bash
cd sportsday-hub
pnpm add -D tsx
```

`package.json`의 `scripts`에 추가:

```json
{
  "scripts": {
    "migrate:md": "tsx scripts/migrate-from-md.ts"
  }
}
```

- [ ] **Step 6: 스크립트 실행 — 시드 SQL 생성**

```bash
pnpm migrate:md
```

Expected: 결과 리포트 출력. 대략:
- teams: 5
- decisions: 7
- milestones: 15~20 (회의 6 + 산출물 ~15)
- checklist_items: 50~70
- issues: 0~5 (현재 빈 이슈 로그)

`migrations/0005_seed_data.sql`이 생성되었는지 확인:

```bash
head -20 migrations/0005_seed_data.sql
```

- [ ] **Step 7: 시드 데이터 클라우드 DB에 적용**

```bash
pnpm supabase db push
```

새 마이그레이션 `0005_seed_data.sql`이 클라우드 DB에 적용된다.

> 주의: `db push`는 마이그레이션 파일을 추적한다. 시드를 재생성해서 다시 적용하려면, `pnpm supabase migration repair --status reverted --migration 0005_seed_data`로 추적을 리셋한 뒤 다시 `db push`. 또는 Supabase 대시보드 SQL Editor에서 직접 실행.

Supabase 대시보드 → Table Editor에서 데이터 확인:
- teams 테이블: 5행
- decisions: 7행
- milestones: ~20행
- checklist_items: ~60행

- [ ] **Step 8: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 마크다운 이주 스크립트 + 시드 데이터 생성·적용"
```

---

## Task 6: Supabase 클라이언트 + 쿼리 레이어

**Files:**
- Create: `sportsday-hub/lib/supabase/server.ts`
- Create: `sportsday-hub/lib/supabase/client.ts`
- Create: `sportsday-hub/lib/queries/teams.ts`
- Create: `sportsday-hub/lib/queries/decisions.ts`
- Create: `sportsday-hub/lib/queries/milestones.ts`
- Create: `sportsday-hub/lib/queries/checklist.ts`
- Create: `sportsday-hub/lib/queries/issues.ts`
- Create: `sportsday-hub/app/providers.tsx`

**Interfaces:**
- Consumes: Task 2의 타입, Task 3의 스키마
- Produces: `createClient()` (서버), `createBrowserClient()` (클라이언트), 각 쿼리 함수(`getTeams`, `getDecisions`, `getMilestones`, `getChecklistItems`, `getIssues`). Task 7-9의 화면이 이 함수들 사용.

- [ ] **Step 1: 서버 Supabase 클라이언트**

`lib/supabase/server.ts` 생성:

```typescript
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서 호출 시 무시 (조회 전용)
          }
        },
      },
    }
  )
}
```

- [ ] **Step 2: 브라우저 Supabase 클라이언트**

`lib/supabase/client.ts` 생성:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

> 참고: 닉네임 context RPC는 Plan B(편집 기능)에서 추가. Plan A는 읽기 전용이므로 context 불필요.

- [ ] **Step 3: 쿼리 키 중앙 관리**

`lib/queries/keys.ts` 생성:

```typescript
export const queryKeys = {
  teams: ['teams'] as const,
  team: (id: string) => ['teams', id] as const,
  decisions: ['decisions'] as const,
  milestones: ['milestones'] as const,
  milestonesByTeam: (teamId: string) => ['milestones', 'team', teamId] as const,
  checklist: ['checklist'] as const,
  checklistByTeam: (teamId: string) => ['checklist', 'team', teamId] as const,
  issues: ['issues'] as const,
  issuesByTeam: (teamId: string) => ['issues', 'team', teamId] as const,
}
```

- [ ] **Step 4: 팀 쿼리**

`lib/queries/teams.ts` 생성:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Team } from '@/lib/types/models'

export async function getTeams(): Promise<Team[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getTeam(id: string): Promise<Team | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
```

- [ ] **Step 5: 결정 쿼리**

`lib/queries/decisions.ts` 생성:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Decision } from '@/lib/types/models'

export async function getDecisions(): Promise<Decision[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('decisions')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 6: 마일스톤 쿼리**

`lib/queries/milestones.ts` 생성:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Milestone, TeamId } from '@/lib/types/models'

export async function getMilestones(): Promise<Milestone[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .order('date')
  if (error) throw error
  return data ?? []
}

export async function getMilestonesByTeam(
  teamId: TeamId
): Promise<Milestone[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('team_id', teamId)
    .order('date')
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 7: 체크리스트 쿼리**

`lib/queries/checklist.ts` 생성:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { ChecklistItem, TeamId } from '@/lib/types/models'

export async function getChecklistItems(): Promise<ChecklistItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .order('team_id')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getChecklistByTeam(
  teamId: TeamId
): Promise<ChecklistItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('team_id', teamId)
    .order('section')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 8: 이슈 쿼리**

`lib/queries/issues.ts` 생성:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Issue, TeamId } from '@/lib/types/models'

export async function getIssues(): Promise<Issue[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .order('date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function getIssuesByTeam(teamId: TeamId): Promise<Issue[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('team_id', teamId)
    .order('date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 9: TanStack Query Provider**

`app/providers.tsx` 생성:

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30초
            refetchOnWindowFocus: true,
          },
        },
      })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```

- [ ] **Step 10: 타입 체크**

```bash
cd sportsday-hub
pnpm tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 11: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: Supabase 클라이언트 + 쿼리 레이어 + TanStack Query provider"
```

---

## Task 7: 루트 레이아웃 + 사이드바 + 공통 컴포넌트

**Files:**
- Create: `sportsday-hub/app/layout.tsx` (수정)
- Create: `sportsday-hub/components/layout/sidebar.tsx`
- Create: `sportsday-hub/components/layout/app-sidebar.tsx`
- Create: `sportsday-hub/components/shared/status-badge.tsx`
- Create: `sportsday-hub/components/shared/priority-badge.tsx`
- Create: `sportsday-hub/components/shared/empty-state.tsx`
- Create: `sportsday-hub/lib/markdown/renderer.tsx`

**Interfaces:**
- Consumes: Task 6의 `getTeams()`, TanStack Query provider
- Produces: 사이드바가 있는 루트 레이아웃, 재사용 가능는 배지/empty-state/마크다운 렌더러. Task 8-10의 화면이 이 컴포넌트들 사용.

- [ ] **Step 1: 상태 배지 컴포넌트**

`components/shared/status-badge.tsx` 생성:

```typescript
import { Badge } from '@/components/ui/badge'
import {
  DECISION_STATUS_LABEL,
  type DecisionStatus,
} from '@/lib/types/models'

const STATUS_STYLE: Record<DecisionStatus, string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-300',
  discussing: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  pending: 'bg-gray-100 text-gray-600 border-gray-300',
  deferred: 'bg-blue-100 text-blue-700 border-blue-300',
}

const STATUS_ICON: Record<DecisionStatus, string> = {
  confirmed: '🟢',
  discussing: '🟡',
  pending: '⚪',
  deferred: '⚪',
}

export function StatusBadge({ status }: { status: DecisionStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLE[status]}>
      <span className="mr-1">{STATUS_ICON[status]}</span>
      {DECISION_STATUS_LABEL[status]}
    </Badge>
  )
}
```

- [ ] **Step 2: 우선순위 배지 컴포넌트**

`components/shared/priority-badge.tsx` 생성:

```typescript
import { PRIORITY_LABEL, type Priority } from '@/lib/types/models'

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'text-red-600',
  medium: 'text-yellow-600',
  low: 'text-green-600',
}

const PRIORITY_DOT: Record<Priority, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
}

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null
  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${PRIORITY_STYLE[priority]}`}
      title={PRIORITY_LABEL[priority]}
    >
      <span className="mr-1">{PRIORITY_DOT[priority]}</span>
      {PRIORITY_LABEL[priority]}
    </span>
  )
}
```

- [ ] **Step 3: Empty state 컴포넌트**

`components/shared/empty-state.tsx` 생성:

```typescript
import { Inbox } from 'lucide-react'

export function EmptyState({
  title = '데이터가 없습니다',
  description,
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="mb-3 h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 마크다운 렌더러**

`lib/markdown/renderer.tsx` 생성:

```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

export function MarkdownRenderer({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'prose-headings:font-semibold prose-headings:text-foreground',
        'prose-table:text-sm prose-th:bg-muted prose-th:px-3 prose-th:py-2',
        'prose-td:px-3 prose-td:py-2 prose-td:border-border',
        'prose-a:text-primary prose-a:underline',
        'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
```

Tailwind typography 플러그인 설치:

```bash
cd sportsday-hub
pnpm add -D @tailwindcss/typography
```

`globals.css` 또는 Tailwind 설정에 플러그인 추가 (Tailwind v4 기준):

Tailwind v4는 CSS-first 설정이므로, `app/globals.css` 최상단에:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

(create-next-app이 생성한 globals.css의 기존 `@import "tailwindcss";` 아래에 `@plugin` 라인 추가.)

- [ ] **Step 5: 사이드바 컴포넌트**

shadcn sidebar 컴포넌트 추가:

```bash
pnpm dlx shadcn@latest add sidebar
```

`components/layout/app-sidebar.tsx` 생성:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarClock,
  CheckSquare,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import type { Team } from '@/lib/types/models'
import * as Icons from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/timeline', label: '타임라인', icon: CalendarClock },
  { href: '/checklists', label: '체크리스트', icon: CheckSquare },
]

function getIcon(name: string): LucideIcon {
  return (Icons as Record<string, LucideIcon>)[name] ?? Icons.Circle
}

export function AppSidebar({ teams }: { teams: Team[] }) {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <div className="text-lg font-bold">HI-Side Out Hub</div>
        <div className="text-xs text-muted-foreground">
          2026. 9. 19 (토) · D-{daysUntil()}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>전체</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href)
                    }
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>팀 워크스페이스</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {teams.map((team) => {
                const Icon = getIcon(team.icon)
                return (
                  <SidebarMenuItem key={team.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/team/${team.id}`}
                    >
                      <Link href={`/team/${team.id}`}>
                        <Icon style={{ color: team.color }} />
                        <span>{team.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

function daysUntil(): number {
  const event = new Date('2026-09-19')
  const now = new Date()
  return Math.max(
    0,
    Math.ceil((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  )
}
```

- [ ] **Step 6: 사이드바 컨테이너 (서버에서 teams 로드)**

`components/layout/sidebar.tsx` 생성:

```typescript
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { getTeams } from '@/lib/queries/teams'

export async function SidebarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const teams = await getTeams()
  return (
    <SidebarProvider>
      <AppSidebar teams={teams} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

- [ ] **Step 7: 루트 레이아웃 수정**

`app/layout.tsx` 수정 (create-next-app 기본을 교체):

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { SidebarLayout } from '@/components/layout/sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HI-Side Out Hub — 26-2 스포츠데이',
  description: '26-2 스포츠데이 기획팀 협업 허브',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <SidebarLayout>{children}</SidebarLayout>
        </Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 8: 개발 서버로 사이드바 확인**

```bash
cd sportsday-hub
pnpm dev
```

`http://localhost:3000` 접속 → 사이드바에 "HI-Side Out Hub", 대시보드/타임라인/체크리스트 메뉴, 팀 5개 표시 확인.

> 주의: 클라우드 Supabase 프로젝트가 생성되어 있어야 함 (Task 3 Step 4). `.env.local`에 클라우드 URL/키 설정:
> ```
> NEXT_PUBLIC_SUPABASE_URL=https://<프로젝트-ref>.supabase.co
> NEXT_PUBLIC_SUPABASE_ANON_KEY=<클라우드 anon 키 — Project Settings → API에서 확인>
> ```

- [ ] **Step 9: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 루트 레이아웃 + 사이드바 + 공통 배지/empty/마크다운 렌더러"
```

---

## Task 8: 대시보드 화면 (읽기 전용)

**Files:**
- Create: `sportsday-hub/app/page.tsx`
- Create: `sportsday-hub/components/dashboard/stats-cards.tsx`
- Create: `sportsday-hub/components/dashboard/decision-tracker.tsx`
- Create: `sportsday-hub/components/dashboard/team-status-card.tsx`
- Create: `sportsday-hub/components/dashboard/upcoming-milestones.tsx`

**Interfaces:**
- Consumes: Task 6의 `getDecisions`, `getTeams`, `getMilestones`, `getChecklistItems`, `getIssues`. Task 7의 `StatusBadge`, `EmptyState`.
- Produces: `/` 경로의 대시보드 페이지.

- [ ] **Step 1: 통계 카드 컴포넌트**

`components/dashboard/stats-cards.tsx` 생성:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Decision, Milestone, ChecklistItem } from '@/lib/types/models'

export function StatsCards({
  decisions,
  checklist,
}: {
  decisions: Decision[]
  checklist: ChecklistItem[]
}) {
  const confirmed = decisions.filter((d) => d.status === 'confirmed').length
  const discussing = decisions.filter((d) => d.status === 'discussing').length
  const pending = decisions.filter(
    (d) => d.status === 'pending' || d.status === 'deferred'
  ).length
  const completedChecks = checklist.filter((c) => c.completed).length
  const progress =
    checklist.length > 0
      ? Math.round((completedChecks / checklist.length) * 100)
      : 0

  const cards = [
    { label: '확정 결정', value: confirmed, accent: 'text-green-600' },
    { label: '논의중', value: discussing, accent: 'text-yellow-600' },
    { label: '보류/미정', value: pending, accent: 'text-gray-500' },
    { label: '전체 진행률', value: `${progress}%`, accent: 'text-blue-600' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${c.accent}`}>{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 결정 추적표 컴포넌트**

`components/dashboard/decision-tracker.tsx` 생성:

```typescript
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import type { Decision } from '@/lib/types/models'

export function DecisionTracker({ decisions }: { decisions: Decision[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>핵심 결정 추적표</CardTitle>
      </CardHeader>
      <CardContent>
        {decisions.length === 0 ? (
          <EmptyState title="결정 항목이 없습니다" />
        ) : (
          <div className="space-y-2">
            {decisions.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                  {d.id}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.title}</div>
                  {d.current_value && (
                    <div className="truncate text-xs text-muted-foreground">
                      {d.current_value}
                    </div>
                  )}
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: 팀 현황 카드 컴포넌트**

`components/dashboard/team-status-card.tsx` 생성:

```typescript
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Team, ChecklistItem, Issue } from '@/lib/types/models'

export function TeamStatusCard({
  team,
  checklist,
  issues,
}: {
  team: Team
  checklist: ChecklistItem[]
  issues: Issue[]
}) {
  const teamChecks = checklist.filter((c) => c.team_id === team.id)
  const completed = teamChecks.filter((c) => c.completed).length
  const total = teamChecks.length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  const openIssues = issues.filter(
    (i) => i.team_id === team.id && i.status !== 'resolved'
  ).length

  return (
    <Link href={`/team/${team.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="font-medium">{team.name}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <div>진행률 {progress}%</div>
            <div>
              체크 {completed}/{total}
            </div>
            <div>이슈 {openIssues}</div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: team.color }}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 4: 다가오는 마일스톤 컴포넌트**

`components/dashboard/upcoming-milestones.tsx` 생성:

```typescript
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import type { Milestone, Team } from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

export function UpcomingMilestones({
  milestones,
  teams,
}: {
  milestones: Milestone[]
  teams: Team[]
}) {
  const now = new Date()
  const upcoming = milestones
    .filter((m) => !m.completed && parseISO(m.date) >= now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  const teamMap = new Map(teams.map((t) => [t.id, t]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>다가오는 마일스톤</CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <EmptyState title="예정된 마일스톤이 없습니다" />
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => {
              const team = m.team_id ? teamMap.get(m.team_id) : null
              return (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 font-medium">
                    {format(parseISO(m.date), 'M/d (E)', { locale: ko })}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  {team && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-xs"
                      style={{
                        backgroundColor: `${team.color}20`,
                        color: team.color,
                      }}
                    >
                      {team.name}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: 대시보드 페이지**

`app/page.tsx` 수정 (create-next-app 기본을 교체):

```typescript
import { StatsCards } from '@/components/dashboard/stats-cards'
import { DecisionTracker } from '@/components/dashboard/decision-tracker'
import { TeamStatusCard } from '@/components/dashboard/team-status-card'
import { UpcomingMilestones } from '@/components/dashboard/upcoming-milestones'
import { getDecisions } from '@/lib/queries/decisions'
import { getTeams } from '@/lib/queries/teams'
import { getMilestones } from '@/lib/queries/milestones'
import { getChecklistItems } from '@/lib/queries/checklist'
import { getIssues } from '@/lib/queries/issues'

export const revalidate = 60 // 60초 ISR

export default async function DashboardPage() {
  const [decisions, teams, milestones, checklist, issues] = await Promise.all([
    getDecisions(),
    getTeams(),
    getMilestones(),
    getChecklistItems(),
    getIssues(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HI-Side Out</h1>
        <p className="text-sm text-muted-foreground">
          26-2 스포츠데이 기획 허브 · 2026. 9. 19 (토)
        </p>
      </div>

      <StatsCards decisions={decisions} checklist={checklist} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DecisionTracker decisions={decisions} />
        <UpcomingMilestones milestones={milestones} teams={teams} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">팀별 현황</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {teams.map((team) => (
            <TeamStatusCard
              key={team.id}
              team={team}
              checklist={checklist}
              issues={issues}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 개발 서버로 대시보드 확인**

```bash
cd sportsday-hub
pnpm dev
```

`http://localhost:3000` 접속 → 통계 카드(확정 4~5, 논의중 ~2, 보류 ~2, 진행률 %), 결정 추적표(D1~D7), 다가오는 마일스톤, 팀 카드 5개 표시 확인.

- [ ] **Step 7: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 대시보드 화면 (통계/결정추적/팀현황/마일스톤) 읽기 전용"
```

---

## Task 9: 팀 워크스페이스 화면 (읽기 전용)

**Files:**
- Create: `sportsday-hub/app/team/[id]/page.tsx`
- Create: `sportsday-hub/components/team/team-tabs.tsx`
- Create: `sportsday-hub/components/team/guideline-viewer.tsx`
- Create: `sportsday-hub/components/team/checklist-panel.tsx`
- Create: `sportsday-hub/components/team/milestone-panel.tsx`
- Create: `sportsday-hub/components/team/issue-panel.tsx`

**Interfaces:**
- Consumes: Task 6의 `getTeam`, `getChecklistByTeam`, `getMilestonesByTeam`, `getIssuesByTeam`. Task 7의 `MarkdownRenderer`, `PriorityBadge`, `EmptyState`.
- Produces: `/team/[id]` 경로의 팀 워크스페이스. 탭: 개요/지침/체크리스트/마일스톤/이슈.

- [ ] **Step 1: 가이드라인 뷰어**

`components/team/guideline-viewer.tsx` 생성:

```typescript
import { MarkdownRenderer } from '@/lib/markdown/renderer'
import type { Team } from '@/lib/types/models'

export function GuidelineViewer({ team }: { team: Team }) {
  const sections = team.guideline_doc.sections ?? []
  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        지침 내용이 없습니다.
      </p>
    )
  }
  return (
    <div className="space-y-8">
      {sections
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <section key={section.id} className="space-y-2">
            <MarkdownRenderer content={section.content_md} />
          </section>
        ))}
    </div>
  )
}
```

- [ ] **Step 2: 체크리스트 패널**

`components/team/checklist-panel.tsx` 생성:

```typescript
import { Checkbox } from '@/components/ui/checkbox'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { EmptyState } from '@/components/shared/empty-state'
import type { ChecklistItem } from '@/lib/types/models'

const SECTION_LABEL: Record<string, string> = {
  progress: '진행 체크리스트',
  feedback: '피드백 반영',
  prep: '준비',
}

export function ChecklistPanel({ items }: { items: ChecklistItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="체크리스트 항목이 없습니다" />
  }

  const bySection = items.reduce(
    (acc, item) => {
      ;(acc[item.section] ??= []).push(item)
      return acc
    },
    {} as Record<string, ChecklistItem[]>
  )

  return (
    <div className="space-y-6">
      {Object.entries(bySection).map(([section, sectionItems]) => (
        <div key={section}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {SECTION_LABEL[section] ?? section} ({sectionItems.filter((i) => i.completed).length}/
            {sectionItems.length})
          </h3>
          <div className="space-y-1">
            {sectionItems
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border p-2"
                >
                  <Checkbox checked={item.completed} disabled />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      <span
                        className={`text-sm ${
                          item.completed ? 'text-muted-foreground line-through' : ''
                        }`}
                      >
                        {item.content}
                      </span>
                    </div>
                    {item.source && (
                      <span className="text-xs text-muted-foreground">
                        출처: {item.source}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

shadcn checkbox 컴포넌트 추가:

```bash
pnpm dlx shadcn@latest add checkbox
```

- [ ] **Step 3: 마일스톤 패널**

`components/team/milestone-panel.tsx` 생성:

```typescript
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/shared/empty-state'
import type { Milestone } from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

const CATEGORY_LABEL: Record<string, string> = {
  meeting: '회의',
  deliverable: '산출물',
  event: '행사',
}

export function MilestonePanel({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return <EmptyState title="마일스톤이 없습니다" />
  }
  return (
    <div className="space-y-2">
      {milestones.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-md border p-3">
          <Checkbox checked={m.completed} disabled />
          <span className="w-24 shrink-0 text-sm font-medium">
            {format(parseISO(m.date), 'M/d (E)', { locale: ko })}
          </span>
          <span className="min-w-0 flex-1 text-sm">{m.title}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {CATEGORY_LABEL[m.category] ?? m.category}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 이슈 패널**

`components/team/issue-panel.tsx` 생성:

```typescript
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import type { Issue } from '@/lib/types/models'

const STATUS_LABEL: Record<string, string> = {
  open: '열림',
  in_progress: '진행중',
  resolved: '해결됨',
}

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
}

export function IssuePanel({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return <EmptyState title="이슈가 없습니다" description="모두 순조롭게 진행 중" />
  }
  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div key={issue.id} className="flex items-center gap-3 rounded-md border p-3">
          <Badge variant="secondary" className={STATUS_STYLE[issue.status]}>
            {STATUS_LABEL[issue.status]}
          </Badge>
          <span className="min-w-0 flex-1 text-sm">{issue.title}</span>
          {issue.date && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {issue.date}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: 팀 탭 컨테이너 (클라이언트)**

`components/team/team-tabs.tsx` 생성:

```typescript
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GuidelineViewer } from './guideline-viewer'
import { ChecklistPanel } from './checklist-panel'
import { MilestonePanel } from './milestone-panel'
import { IssuePanel } from './issue-panel'
import { MarkdownRenderer } from '@/lib/markdown/renderer'
import type { Team, ChecklistItem, Milestone, Issue } from '@/lib/types/models'

export function TeamTabs({
  team,
  checklist,
  milestones,
  issues,
}: {
  team: Team
  checklist: ChecklistItem[]
  milestones: Milestone[]
  issues: Issue[]
}) {
  const completed = checklist.filter((c) => c.completed).length
  const progress =
    checklist.length > 0
      ? Math.round((completed / checklist.length) * 100)
      : 0

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">개요</TabsTrigger>
        <TabsTrigger value="guideline">지침</TabsTrigger>
        <TabsTrigger value="checklist">
          체크리스트 ({completed}/{checklist.length})
        </TabsTrigger>
        <TabsTrigger value="milestones">마일스톤</TabsTrigger>
        <TabsTrigger value="issues">이슈 ({issues.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-semibold">미션</h3>
          <p className="text-sm text-muted-foreground">{team.mission}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">진행률</h3>
            <span className="text-2xl font-bold" style={{ color: team.color }}>
              {progress}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, backgroundColor: team.color }}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="guideline" className="mt-4">
        <GuidelineViewer team={team} />
      </TabsContent>

      <TabsContent value="checklist" className="mt-4">
        <ChecklistPanel items={checklist} />
      </TabsContent>

      <TabsContent value="milestones" className="mt-4">
        <MilestonePanel milestones={milestones} />
      </TabsContent>

      <TabsContent value="issues" className="mt-4">
        <IssuePanel issues={issues} />
      </TabsContent>
    </Tabs>
  )
}
```

- [ ] **Step 6: 팀 페이지 (서버)**

`app/team/[id]/page.tsx` 생성:

```typescript
import { notFound } from 'next/navigation'
import { TeamTabs } from '@/components/team/team-tabs'
import { getTeam, getTeams } from '@/lib/queries/teams'
import { getChecklistByTeam } from '@/lib/queries/checklist'
import { getMilestonesByTeam } from '@/lib/queries/milestones'
import { getIssuesByTeam } from '@/lib/queries/issues'
import { TEAM_IDS } from '@/lib/types/models'

export const revalidate = 60

export async function generateStaticParams() {
  return TEAM_IDS.map((id) => ({ id }))
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!TEAM_IDS.includes(id as (typeof TEAM_IDS)[number])) {
    notFound()
  }

  const team = await getTeam(id)
  if (!team) notFound()

  const [checklist, milestones, issues] = await Promise.all([
    getChecklistByTeam(id as (typeof TEAM_IDS)[number]),
    getMilestonesByTeam(id as (typeof TEAM_IDS)[number]),
    getIssuesByTeam(id as (typeof TEAM_IDS)[number]),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: team.color }}
        />
        <h1 className="text-2xl font-bold">{team.name}</h1>
      </div>
      <TeamTabs
        team={team}
        checklist={checklist}
        milestones={milestones}
        issues={issues}
      />
    </div>
  )
}
```

- [ ] **Step 7: 개발 서버로 팀 페이지 확인**

```bash
cd sportsday-hub
pnpm dev
```

각 팀 URL 방문 (`/team/content`, `/team/budget`, `/team/exchange`, `/team/timeline`, `/team/management`). 탭 전환(개요/지침/체크리스트/마일스톤/이슈) 확인. 지침 탭에서 마크다운 렌더링(표·헤딩) 확인.

- [ ] **Step 8: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 팀 워크스페이스 화면 (개요/지침/체크리스트/마일스톤/이슈 탭)"
```

---

## Task 10: 타임라인 + 체크리스트 통합 화면 + 첫 배포

**Files:**
- Create: `sportsday-hub/app/timeline/page.tsx`
- Create: `sportsday-hub/components/timeline/timeline-list.tsx`
- Create: `sportsday-hub/app/checklists/page.tsx`
- Create: `sportsday-hub/components/checklist/unified-checklist.tsx`
- Create: `sportsday-hub/README.md`

**Interfaces:**
- Consumes: Task 6의 모든 쿼리. Task 7-9의 공통 컴포넌트.
- Produces: `/timeline`, `/checklists` 페이지. Plan A 완성 — 첫 배포 가능 상태.

- [ ] **Step 1: 타임라인 리스트 컴포넌트**

`components/timeline/timeline-list.tsx` 생성 (간트 대신 단순 리스트 — 강화 버전은 Plan B):

```typescript
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/shared/empty-state'
import type { Milestone, Team } from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

const CATEGORY_LABEL: Record<string, string> = {
  meeting: '회의',
  deliverable: '산출물',
  event: '행사',
}

const CATEGORY_STYLE: Record<string, string> = {
  meeting: 'bg-purple-100 text-purple-800',
  deliverable: 'bg-blue-100 text-blue-800',
  event: 'bg-red-100 text-red-800',
}

export function TimelineList({
  milestones,
  teams,
}: {
  milestones: Milestone[]
  teams: Team[]
}) {
  if (milestones.length === 0) {
    return <EmptyState title="마일스톤이 없습니다" />
  }
  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date))

  // 월별 그룹핑
  const byMonth = new Map<string, Milestone[]>()
  for (const m of sorted) {
    const monthKey = format(parseISO(m.date), 'yyyy-MM')
    ;(byMonth.get(monthKey) ?? byMonth.set(monthKey, []).get(monthKey)!).push(m)
  }

  return (
    <div className="space-y-6">
      {Array.from(byMonth.entries()).map(([month, items]) => (
        <div key={month}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {format(parseISO(`${month}-01`), 'yyyy년 M월', { locale: ko })}
          </h3>
          <div className="space-y-1">
            {items.map((m) => {
              const team = m.team_id ? teamMap.get(m.team_id) : null
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-md border p-2"
                >
                  <Checkbox checked={m.completed} disabled />
                  <span className="w-24 shrink-0 text-sm font-medium">
                    {format(parseISO(m.date), 'M/d (E)', { locale: ko })}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                      CATEGORY_STYLE[m.category] ?? ''
                    }`}
                  >
                    {CATEGORY_LABEL[m.category] ?? m.category}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">{m.title}</span>
                  {team && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-xs"
                      style={{
                        backgroundColor: `${team.color}20`,
                        color: team.color,
                      }}
                    >
                      {team.name}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 타임라인 페이지**

`app/timeline/page.tsx` 생성:

```typescript
import { TimelineList } from '@/components/timeline/timeline-list'
import { getMilestones } from '@/lib/queries/milestones'
import { getTeams } from '@/lib/queries/teams'

export const revalidate = 60

export default async function TimelinePage() {
  const [milestones, teams] = await Promise.all([getMilestones(), getTeams()])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">타임라인</h1>
        <p className="text-sm text-muted-foreground">
          전체 마일스톤 & 산출물 일정
        </p>
      </div>
      <TimelineList milestones={milestones} teams={teams} />
    </div>
  )
}
```

- [ ] **Step 3: 통합 체크리스트 컴포넌트**

`components/checklist/unified-checklist.tsx` 생성:

```typescript
'use client'

import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { EmptyState } from '@/components/shared/empty-state'
import type { ChecklistItem, Team } from '@/lib/types/models'

export function UnifiedChecklist({
  items,
  teams,
}: {
  items: ChecklistItem[]
  teams: Team[]
}) {
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'complete'>('all')

  const filtered = useMemo(() => {
    if (filter === 'incomplete') return items.filter((i) => !i.completed)
    if (filter === 'complete') return items.filter((i) => i.completed)
    return items
  }, [items, filter])

  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const completed = items.filter((i) => i.completed).length
  const progress =
    items.length > 0 ? Math.round((completed / items.length) * 100) : 0

  // 팀별 그룹핑 (전체 건 team_id=null은 별도)
  const byTeam = new Map<string | null, ChecklistItem[]>()
  for (const item of filtered) {
    const key = item.team_id
    ;(byTeam.get(key) ?? byTeam.set(key, []).get(key)!).push(item)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-sm font-medium">
          {completed}/{items.length} ({progress}%)
        </span>
      </div>

      <div className="flex gap-2">
        {([
          ['all', '전체'],
          ['incomplete', '미완료'],
          ['complete', '완료'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-md px-3 py-1 text-sm ${
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {byTeam.size === 0 ? (
        <EmptyState title="해당 항목이 없습니다" />
      ) : (
        <Accordion type="multiple" className="w-full">
          {Array.from(byTeam.entries()).map(([teamId, teamItems]) => {
            const team = teamId ? teamMap.get(teamId) : null
            const teamCompleted = teamItems.filter((i) => i.completed).length
            return (
              <AccordionItem key={teamId ?? 'global'} value={teamId ?? 'global'}>
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    {team && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                    )}
                    {team?.name ?? '전체'}
                    <span className="text-xs text-muted-foreground">
                      ({teamCompleted}/{teamItems.length})
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1">
                    {teamItems
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 rounded-md border p-2"
                        >
                          <Checkbox checked={item.completed} disabled />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority={item.priority} />
                              <span
                                className={`text-sm ${
                                  item.completed
                                    ? 'text-muted-foreground line-through'
                                    : ''
                                }`}
                              >
                                {item.content}
                              </span>
                            </div>
                            {item.source && (
                              <span className="text-xs text-muted-foreground">
                                출처: {item.source}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 체크리스트 페이지**

`app/checklists/page.tsx` 생성:

```typescript
import { UnifiedChecklist } from '@/components/checklist/unified-checklist'
import { getChecklistItems } from '@/lib/queries/checklist'
import { getTeams } from '@/lib/queries/teams'

export const revalidate = 60

export default async function ChecklistsPage() {
  const [items, teams] = await Promise.all([getChecklistItems(), getTeams()])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">체크리스트</h1>
        <p className="text-sm text-muted-foreground">
          전체 팀 체크리스트 통합 뷰
        </p>
      </div>
      <UnifiedChecklist items={items} teams={teams} />
    </div>
  )
}
```

- [ ] **Step 5: README 작성**

`README.md` 생성 (sportsday-hub 루트):

````markdown
# HI-Side Out Hub

26-2 스포츠데이 기획팀 협업 허브.

## 개발 환경 설정

### 사전 요구사항
- Node.js v20+
- pnpm
- 클라우드 Supabase 프로젝트 (supabase.com 무료 티어)

### 설치

```bash
pnpm install
```

### 환경 변수

`.env.local` 생성:

```bash
cp .env.local.example .env.local
# 클라우드 Supabase URL/anon key 입력 (Project Settings → API)
```

### Supabase 연결 + 마이그레이션

```bash
pnpm supabase link --project-ref <프로젝트-ref>
pnpm supabase db push    # 마이그레이션 적용
```

### 마크다운에서 데이터 이주

원본 마크다운(`content-source/`)에서 시드 SQL 재생성:

```bash
pnpm migrate:md
pnpm supabase db push    # 시드 마이그레이션 적용
```

### 개발 서버

```bash
pnpm dev
```

`http://localhost:3000` 접속.

### 테스트

```bash
pnpm test          # 마크다운 파서 단위/통합 테스트
```

## 기술 스택

- Next.js 15 (App Router) + React 19
- shadcn/ui + Tailwind CSS v4
- Supabase (Postgres)
- TanStack Query v5
- react-markdown + remark-gfm

## 데이터 구조

- `migrations/` — Supabase SQL 마이그레이션
- `scripts/migrate-from-md.ts` — 마크다운 → SQL 시드 변환
- `content-source/` — 이주 원본 마크다운
- `lib/` — 쿼리, 타입, 유틸
````

- [ ] **Step 6: 전체 빌드 확인**

```bash
cd sportsday-hub
pnpm build
```

Expected: 빌드 성공. 4개 페이지(/, /team/[id], /timeline, /checklists) 정적/동적 라우트 생성.

빌드 에러가 있으면 수정. 흔한 이슈:
- 타입 불일치 → `pnpm tsc --noEmit`로 확인
- lucide 아이콘명 오타 → `team.icon` 값과 lucide-react export 일치 확인

- [ ] **Step 7: 모든 화면 수동 검증**

```bash
pnpm dev
```

체크리스트:
- [ ] `/` 대시보드 — 통계 카드, 결정 추적표(D1~D7), 팀 카드 5개, 다가오는 마일스톤
- [ ] `/team/content` — 5개 탭 전환, 지침 마크다운 렌더링(표 포함)
- [ ] `/team/budget`, `/team/exchange`, `/team/timeline`, `/team/management` — 각각 정상
- [ ] `/timeline` — 월별 그룹핑, 카테고리 배지, 팀 색상
- [ ] `/checklists` — 팀별 아코디언, 필터(전체/미완료/완료), 진행률 바
- [ ] 사이드바 — 모든 메뉴/팀 링크 동작
- [ ] 모바일 뷰포트(Chrome DevTools) — 사이드바 햄버거 토글, 반응형 그리드

- [ ] **Step 8: Vercel 배포**

클라우드 Supabase는 이미 Task 3에서 설정 완료. 이제 프론트엔드 배포:

1. `sportsday-hub` 폴더를 GitHub repo로 푸시 (또는 Vercel CLI)
2. [vercel.com](https://vercel.com)에서 "New Project" → repo 연결
3. 환경 변수 설정:
   - `NEXT_PUBLIC_SUPABASE_URL` = 클라우드 Supabase URL (Task 3에서 사용한 것과 동일)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 클라우드 anon key
4. Deploy

또는 Vercel CLI:

```bash
pnpm add -g vercel
cd sportsday-hub
vercel
```

배포 완료 후 URL로 접속하여 프로덕션에서 모든 화면 작동 확인.

- [ ] **Step 9: 최종 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 타임라인/체크리스트 통합 화면 + README + Plan A 완성 (첫 배포)"
```

---

## Plan A 완료 기준

- [ ] 4개 화면(대시보드/팀 워크스페이스/타임라인/체크리스트) 모두 읽기 전용으로 작동
- [ ] 마크다운 이주: 5개 md 파일 데이터가 DB에 정확히 반영 (이주 결과 리포트로 확인)
- [ ] 마크다운 파서 단위/통합 테스트 통과
- [ ] `pnpm build` 성공
- [ ] Vercel + Supabase 프로덕션 배포 완료
- [ ] 팀원이 URL로 접속해 진행상황 시각적으로 확인 가능

## Plan B 예정 범위 (별도 plan)

Plan A 완료 후 작성:
- 4단계: 편집 기능 (체크 토글, 결정 상태 변경, 마크다운 편집, 항목 추가/삭제) + 낙관적 업데이트
- 5단계: 안전망 (audit_log 트리거, 닉네임 RPC, soft-delete, 휴지통, 변경 이력 뷰)
- 6단계: UX 다듬기 (반응형 튜닝, empty/loading/error state, 간트 차트 강화)
- 7단계: 최종 배포 점검
