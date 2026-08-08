# 26-2 스포츠데이 허브 Plan B — 편집 + 안전망 + UX 다듬기

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 읽기 전용 대시보드(Plan A)를 편집 가능한 협업 허브로 전환 — 체크 토글, 결정 상태 변경, 마크다운 편집, 항목 추가/삭제, 닉네임 식별, 변경 이력(audit_log), soft-delete 휴지통을 추가한다.

**Architecture:** TanStack Query `useMutation` + 낙관적 업데이트로 새로고침 갱신 방식 구현. 모든 쓰기는 브라우저 Supabase 클라이언트(이미 존재하지만 미사용)를 통해, audit_log는 Postgres 트리거가 자동 캡처, 닉네임은 RPC `set_user_context`로 세션 변수 주입. soft-delete는 `deleted_at` 컬럼 + 쿼리 필터로 처리.

**Tech Stack:** Next.js 16, React 19, TanStack Query v5 (낙관적 업데이트), @base-ui/react (shadcn v4.16 — Radix 아님), Supabase Postgres (트리거 기반 audit), sonner (토스트)

**Spec:** `docs/superpowers/specs/2026-08-08-sportsday-hub-design.md` §6 (편집 흐름 & 오류 처리)

## Global Constraints

- **작업 디렉토리:** `sportsday-hub/` (기존 프로젝트, Plan A 완료 상태)
- **패키지 매니저:** `npm` (pnpm은 한국어 경로에서 충돌)
- **UI 프리미티브:** `@base-ui/react` (Radix 아님) — shadcn 컴포넌트는 `render` prop 사용 (`asChild` 아님), checkbox는 `onCheckedChange`, select는 base-ui API
- **쓰기 경로:** 브라우저 Supabase 클라이언트 (`lib/supabase/client.ts`의 `createClient()`) — 이미 존재
- **닉네임:** 인증 없음, `localStorage` 저장 + `set_user_context` RPC로 세션 변수 주입 → audit 트리거가 `current_setting('app.changed_by')` 읽음
- **상태 배지 SSOT:** confirmed(🟢) / discussing(🟡) / pending(⚪) / deferred(⚪) — 기존 유지
- **soft-delete:** 실제 DELETE 아닌 `deleted_at` UPDATE — 쿼리는 항상 `.is('deleted_at', null)` 필터
- **팀 ID 고정값:** `management` | `content` | `budget` | `exchange` | `timeline`
- **빈도 잦은 커밋:** 각 스텝 완료 시 커밋
- **클라우드 DB:** 이미 설정됨 (Project ref: `duxjcbdhaupxvqsxewvt`), 마이그레이션은 `npx supabase db push`로 적용

---

## File Structure (Plan B 범위)

```
sportsday-hub/
├── supabase/migrations/
│   └── 0003_audit_softdelete.sql        # 신규: audit_log + deleted_at + 트리거 + RPC
├── lib/
│   ├── types/
│   │   ├── models.ts                    # 수정: AuditLog 타입 + deleted_at 추가
│   │   └── database.ts                  # 수정: audit_log 테이블 추가
│   ├── queries/
│   │   ├── keys.ts                      # 수정: auditLog 키 추가
│   │   ├── checklist.ts                 # 수정: .is('deleted_at', null) 필터
│   │   ├── decisions.ts                 # 수정: 동일
│   │   ├── milestones.ts                # 수정: 동일
│   │   ├── issues.ts                    # 수정: 동일
│   │   ├── teams.ts                     # 수정: 동일
│   │   └── audit.ts                     # 신규: getAuditLog, getAuditForRecord
│   ├── mutations/
│   │   ├── checklist.ts                 # 신규: useToggleCheck, useAddChecklistItem, useDeleteChecklistItem
│   │   ├── decisions.ts                 # 신규: useUpdateDecision
│   │   ├── milestones.ts                # 신규: useToggleMilestone
│   │   ├── issues.ts                    # 신규: useAddIssue, useUpdateIssue, useDeleteIssue
│   │   ├── teams.ts                     # 신규: useUpdateGuidelineSection
│   │   └── use-nickname.ts              # 신규: 닉네임 컨텍스트 훅
│   └── supabase/
│       └── client.ts                    # 수정: 닉네임 RPC 주입
├── components/
│   ├── layout/
│   │   ├── nickname-dialog.tsx          # 신규: 닉네임 입력 모달
│   │   └── sidebar.tsx                  # 수정: 닉네임 표시
│   ├── editor/
│   │   ├── editable-checkbox.tsx        # 신규: 토글 가능 체크박스
│   │   ├── decision-status-select.tsx   # 신규: 결정 상태 드롭다운
│   │   ├── inline-text-edit.tsx         # 신규: 인라인 텍스트 편집
│   │   ├── markdown-edit-dialog.tsx     # 신규: 마크다운 편집 모달
│   │   └── add-item-button.tsx          # 신규: 항목 추가 버튼
│   ├── team/
│   │   ├── checklist-panel.tsx          # 수정: 클라이언트 전환 + 편집
│   │   ├── milestone-panel.tsx          # 수정: 동일
│   │   ├── issue-panel.tsx              # 수정: 동일
│   │   └── guideline-viewer.tsx         # 수정: 편집 버튼 추가
│   ├── dashboard/
│   │   └── decision-tracker.tsx         # 수정: 상태 셀렉트 + 인라인 편집
│   ├── checklist/
│   │   └── unified-checklist.tsx        # 수정: 체크 토글 활성화
│   └── history/
│       └── audit-log-dialog.tsx         # 신규: 변경 이력 조회 모달
├── app/
│   └── trash/page.tsx                   # 신규: 휴지통 페이지
└── tests/
    └── mutations.test.ts                # 신규: mutation 로직 단위 테스트
```

---

## Task 1: audit_log + soft-delete + 닉네임 RPC 마이그레이션

**Files:**
- Create: `sportsday-hub/supabase/migrations/0003_audit_softdelete.sql`

**Interfaces:**
- Consumes: 기존 스키마(0001, 0002)
- Produces: `audit_log` 테이블, 모든 테이블에 `deleted_at` 컬럼, `set_user_context(p_nickname)` RPC 함수, `audit_trigger()` 트리거 함수. 이후 모든 Task의 기반.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/0003_audit_softdelete.sql` 생성:

```sql
-- Plan B: audit_log + soft-delete + 닉네임 세션 변수

-- ===== audit_log 테이블 =====
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   text not null,
  action      text not null check (action in ('insert','update','delete')),
  changed_by  text not null default '익명',
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_table_record
  on public.audit_log(table_name, record_id);
create index if not exists idx_audit_log_created
  on public.audit_log(created_at desc);

-- ===== audit_log RLS (열린 편집과 동일) =====
alter table public.audit_log enable row level security;
create policy "audit_open_read"  on public.audit_log for select using (true);
create policy "audit_open_write" on public.audit_log for insert with check (true);

-- ===== 닉네임 세션 변수 설정 RPC =====
-- 클라이언트가 supabase.rpc('set_user_context', { p_nickname: '지훈' }) 호출
create or replace function public.set_user_context(p_nickname text)
returns void as $$
begin
  perform set_config('app.changed_by', coalesce(p_nickname, '익명'), true);
end;
$$ language plpgsql security definer;

-- ===== audit 트리거 함수 =====
-- 모든 대상 테이블의 INSERT/UPDATE/DELETE를 캡처
create or replace function public.audit_capture()
returns trigger as $$
begin
  insert into public.audit_log (table_name, record_id, action, changed_by, old_value, new_value)
  values (
    tg_table_name,
    coalesce((new).id::text, (old).id::text),
    tg_op,
    coalesce(current_setting('app.changed_by', true), '익명'),
    case when tg_op in ('update','delete') then to_jsonb(old) - 'guideline_doc' end,
    case when tg_op in ('insert','update') then to_jsonb(new) - 'guideline_doc' end
  );
  return coalesce(new, old);
end;
$$ language plpgsql;

-- ===== 트리거 부착 (5개 테이블) =====
drop trigger if exists trg_audit_decisions       on public.decisions;
drop trigger if exists trg_audit_milestones       on public.milestones;
drop trigger if exists trg_audit_checklist_items  on public.checklist_items;
drop trigger if exists trg_audit_issues           on public.issues;

create trigger trg_audit_decisions
  after insert or update or delete on public.decisions
  for each row execute function public.audit_capture();

create trigger trg_audit_milestones
  after insert or update or delete on public.milestones
  for each row execute function public.audit_capture();

create trigger trg_audit_checklist_items
  after insert or update or delete on public.checklist_items
  for each row execute function public.audit_capture();

create trigger trg_audit_issues
  after insert or update or delete on public.issues
  for each row execute function public.audit_capture();

-- teams는 guideline_doc(JSONB, 큼)을 제외하고 캡처 (위 함수에서 - 'guideline_doc' 처리)
drop trigger if exists trg_audit_teams on public.teams;
create trigger trg_audit_teams
  after insert or update or delete on public.teams
  for each row execute function public.audit_capture();

-- ===== soft-delete: deleted_at 컬럼 추가 =====
alter table public.teams           add column if not exists deleted_at timestamptz;
alter table public.decisions       add column if not exists deleted_at timestamptz;
alter table public.milestones      add column if not exists deleted_at timestamptz;
alter table public.checklist_items add column if not exists deleted_at timestamptz;
alter table public.issues          add column if not exists deleted_at timestamptz;
```

> **참고:** 시드(0005)의 `DELETE FROM`은 hard-delete이므로 soft-delete와 충돌하지 않는다. 재실행 시 전체 데이터를 지우고 다시 넣으므로 `deleted_at`이 무의미해지지만, 프로덕션에서는 시드를 재실행하지 않는다.

- [ ] **Step 2: 클라우드 DB에 마이그레이션 적용**

```bash
cd sportsday-hub
npx supabase db push
```

프롬프트에서 `y` 입력. `0003_audit_softdelete.sql`이 적용되는지 확인.

- [ ] **Step 3: 적용 확인**

Supabase 대시보드 → Table Editor에서:
- `audit_log` 테이블이 생성되었는지 확인
- 기존 5개 테이블에 `deleted_at` 컬럼이 추가되었는지 확인

또는 CLI로:
```bash
npx supabase db query --linked "SELECT column_name FROM information_schema.columns WHERE table_name = 'checklist_items' AND column_name = 'deleted_at';"
```

- [ ] **Step 4: RPC 함수 테스트**

```bash
npx supabase db query --linked "SELECT public.set_user_context('테스트닉네임'); SELECT current_setting('app.changed_by', true);"
```

`테스트닉네임`이 반환되면 정상.

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: audit_log + soft-delete + 닉네임 RPC 마이그레이션 (Plan B Task 1)"
```

---

## Task 2: 타입 + 데이터베이스 정의 업데이트

**Files:**
- Modify: `sportsday-hub/lib/types/models.ts`
- Modify: `sportsday-hub/lib/types/database.ts`

**Interfaces:**
- Consumes: Task 1의 스키마
- Produces: `AuditLog` 타입, `AuditAction` union, 기존 타입에 `deleted_at?: string | null` 추가. 모든 mutation/component가 이 타입 사용.

- [ ] **Step 1: AuditLog 타입 추가**

`lib/types/models.ts` 파일 끝에 추가:

```typescript
// ===== 감사 로그 (Plan B) =====
export const AUDIT_ACTIONS = ['insert', 'update', 'delete'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  table_name: z.string(),
  record_id: z.string(),
  action: z.enum(AUDIT_ACTIONS),
  changed_by: z.string().default('익명'),
  old_value: z.any().nullable(),
  new_value: z.any().nullable(),
  created_at: z.string().optional(),
})
export type AuditLog = z.infer<typeof auditLogSchema>

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  insert: '생성',
  update: '수정',
  delete: '삭제',
}
```

- [ ] **Step 2: 기존 스키마에 deleted_at 추가**

`lib/types/models.ts`에서 각 스키마(teamSchema, decisionSchema, milestoneSchema, checklistItemSchema, issueSchema)의 마지막 필드 `updated_at` 뒤에 `deleted_at` 추가:

각 스키마의 `updated_at: z.string().optional(),` 줄 뒤에 다음 줄 추가:
```typescript
  deleted_at: z.string().nullable().optional(),
```

예시 (teamSchema):
```typescript
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
})
```

5개 스키마 모두에 동일하게 적용.

- [ ] **Step 3: database.ts에 audit_log 추가**

`lib/types/database.ts`의 `Tables` 객체에 `audit_log` 항목 추가:

```typescript
import type {
  Team,
  Decision,
  Milestone,
  ChecklistItem,
  Issue,
  AuditLog,
} from './models'

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
      audit_log: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: Partial<AuditLog>
      }
    }
  }
}
```

- [ ] **Step 4: 타입 체크**

```bash
cd sportsday-hub
npx tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: AuditLog 타입 + deleted_at 필드 추가 (Plan B Task 2)"
```

---

## Task 3: 쿼리에 deleted_at 필터 추가 + audit 쿼리

**Files:**
- Modify: `sportsday-hub/lib/queries/checklist.ts`
- Modify: `sportsday-hub/lib/queries/decisions.ts`
- Modify: `sportsday-hub/lib/queries/milestones.ts`
- Modify: `sportsday-hub/lib/queries/issues.ts`
- Modify: `sportsday-hub/lib/queries/teams.ts`
- Modify: `sportsday-hub/lib/queries/keys.ts`
- Create: `sportsday-hub/lib/queries/audit.ts`

**Interfaces:**
- Consumes: Task 2의 타입
- Produces: 모든 쿼리가 `deleted_at IS NULL` 행만 반환. `getAuditLog()`, `getAuditForRecord(table, recordId)`. `queryKeys.auditLog`.

- [ ] **Step 1: 각 쿼리에 .is('deleted_at', null) 필터 추가**

각 쿼리 파일의 `.select('*')` 뒤에 `.is('deleted_at', null)` 추가.

**checklist.ts** — `getChecklistItems`와 `getChecklistByTeam`:
```typescript
// getChecklistItems:
const { data, error } = await supabase
  .from('checklist_items')
  .select('*')
  .is('deleted_at', null)
  .order('team_id')
  .order('sort_order')

// getChecklistByTeam:
const { data, error } = await supabase
  .from('checklist_items')
  .select('*')
  .eq('team_id', teamId)
  .is('deleted_at', null)
  .order('section')
  .order('sort_order')
```

**decisions.ts** — `getDecisions`:
```typescript
const { data, error } = await supabase
  .from('decisions')
  .select('*')
  .is('deleted_at', null)
  .order('sort_order')
```

**milestones.ts** — `getMilestones`와 `getMilestonesByTeam`:
```typescript
// getMilestones:
const { data, error } = await supabase
  .from('milestones')
  .select('*')
  .is('deleted_at', null)
  .order('date')

// getMilestonesByTeam:
const { data, error } = await supabase
  .from('milestones')
  .select('*')
  .eq('team_id', teamId)
  .is('deleted_at', null)
  .order('date')
```

**issues.ts** — `getIssues`와 `getIssuesByTeam`:
```typescript
// getIssues:
const { data, error } = await supabase
  .from('issues')
  .select('*')
  .is('deleted_at', null)
  .order('date', { ascending: false, nullsFirst: false })

// getIssuesByTeam:
const { data, error } = await supabase
  .from('issues')
  .select('*')
  .eq('team_id', teamId)
  .is('deleted_at', null)
  .order('date', { ascending: false, nullsFirst: false })
```

**teams.ts** — `getTeams`와 `getTeam`:
```typescript
// getTeams:
const { data, error } = await supabase
  .from('teams')
  .select('*')
  .is('deleted_at', null)
  .order('sort_order')

// getTeam:
const { data, error } = await supabase
  .from('teams')
  .select('*')
  .eq('id', id)
  .is('deleted_at', null)
  .maybeSingle()
```

- [ ] **Step 2: queryKeys에 auditLog 추가**

`lib/queries/keys.ts`의 `queryKeys` 객체에 추가:

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
  auditLog: ['audit-log'] as const,
  auditForRecord: (table: string, recordId: string) =>
    ['audit-log', table, recordId] as const,
}
```

- [ ] **Step 3: audit 쿼리 파일 생성**

`lib/queries/audit.ts` 생성:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { AuditLog } from '@/lib/types/models'

export async function getAuditLog(limit = 50): Promise<AuditLog[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getAuditForRecord(
  table: string,
  recordId: string
): Promise<AuditLog[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('table_name', table)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 4: 타입 체크 + 빌드**

```bash
cd sportsday-hub
npx tsc --noEmit && npm run build
```

Expected: 에러 없음, 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 쿼리에 deleted_at 필터 + audit_log 쿼리 (Plan B Task 3)"
```

---

## Task 4: 닉네임 컨텍스트 + Supabase 클라이언트 수정

**Files:**
- Modify: `sportsday-hub/lib/supabase/client.ts`
- Create: `sportsday-hub/components/layout/nickname-dialog.tsx`
- Modify: `sportsday-hub/app/layout.tsx`

**Interfaces:**
- Consumes: Task 1의 `set_user_context` RPC
- Produces: `getNickname()` / `setNickname(name)` 헬퍼, `NicknameDialog` 컴포넌트. 모든 mutation이 닉네임을 통해 audit에 기록.

- [ ] **Step 1: 닉네임 헬퍼 + Supabase 클라이언트 수정**

`lib/supabase/client.ts` 수정:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

const NICKNAME_KEY = 'sportsday-nickname'

export function getNickname(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(NICKNAME_KEY)
}

export function setNickname(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(NICKNAME_KEY, name)
}

export function hasNickname(): boolean {
  return !!getNickname()
}

export function createClient() {
  const client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return client
}

// 편집 전 호출 — 닉네임을 세션 변수로 주입해 audit 트리거가 읽음
export async function ensureContext(client: ReturnType<typeof createClient>): Promise<void> {
  const nickname = getNickname() ?? '익명'
  await client.rpc('set_user_context', { p_nickname: nickname })
}
```

- [ ] **Step 2: 닉네임 입력 모달 컴포넌트**

`components/layout/nickname-dialog.tsx` 생성:

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { setNickname } from '@/lib/supabase/client'

export function NicknameDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [value, setValue] = useState('')

  const handleSave = () => {
    const name = value.trim()
    if (name) {
      setNickname(name)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>닉네임을 입력해주세요</DialogTitle>
          <DialogDescription>
            편집 시 누가 변경했는지 기록하는 데 사용됩니다. 나중에 언제든 변경할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="예: 지훈"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <DialogFooter>
          <Button onClick={handleSave} disabled={!value.trim()}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: 닉네임 프로바이더 컴포넌트**

`components/layout/nickname-provider.tsx` 생성:

```typescript
'use client'

import { useState, useCallback, createContext, useContext } from 'react'
import { NicknameDialog } from './nickname-dialog'

const NicknameContext = createContext<() => void>(() => {})

export function NicknameProvider({ children }: { children: React.ReactNode }) {
  const [showDialog, setShowDialog] = useState(false)

  const requestNickname = useCallback(() => {
    setShowDialog(true)
  }, [])

  return (
    <NicknameContext.Provider value={requestNickname}>
      {children}
      <NicknameDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
      />
    </NicknameContext.Provider>
  )
}

export function useNicknamePrompt() {
  return useContext(NicknameContext)
}
```

- [ ] **Step 4: 루트 레이아웃에 통합**

`app/layout.tsx` 수정 — `Providers` 안에 `NicknameProvider` 추가:

```typescript
import { NicknameProvider } from '@/components/layout/nickname-provider'

// ... 기존 코드에서:
<Providers>
  <NicknameProvider>
    <SidebarLayout>{children}</SidebarLayout>
  </NicknameProvider>
</Providers>
```

- [ ] **Step 5: 타입 체크**

```bash
cd sportsday-hub
npx tsc --noEmit
```

- [ ] **Step 6: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 닉네임 컨텍스트 + 입력 모달 + Supabase 클라이언트 수정 (Plan B Task 4)"
```

---

## Task 5: mutation 레이어 — 체크리스트

**Files:**
- Create: `sportsday-hub/lib/mutations/checklist.ts`

**Interfaces:**
- Consumes: `createClient`, `ensureContext` from Task 4, `queryKeys` from Task 3, sonner toast
- Produces: `useToggleCheck()`, `useAddChecklistItem()`, `useDeleteChecklistItem()` 훅. Task 8, 9의 편집 컴포넌트가 사용.

- [ ] **Step 1: 체크리스트 mutation 훅 작성**

`lib/mutations/checklist.ts` 생성:

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { ChecklistItem, TeamId } from '@/lib/types/models'

// ===== 체크 토글 (낙관적 업데이트) =====
export function useToggleCheck() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: ChecklistItem) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('checklist_items')
        .update({ completed: !item.completed })
        .eq('id', item.id)
      if (error) throw error
    },
    onMutate: async (item) => {
      // 통합 체크리스트와 팀 체크리스트 모두 무효화
      await queryClient.cancelQueries({ queryKey: queryKeys.checklist })
      const prevAll = queryClient.getQueryData<ChecklistItem[]>(queryKeys.checklist)
      if (prevAll) {
        queryClient.setQueryData<ChecklistItem[]>(
          queryKeys.checklist,
          prevAll.map((i) =>
            i.id === item.id ? { ...i, completed: !i.completed } : i
          )
        )
      }
      return { prevAll }
    },
    onError: (_err, _item, ctx) => {
      if (ctx?.prevAll) {
        queryClient.setQueryData(queryKeys.checklist, ctx.prevAll)
      }
      toast.error('저장 실패. 다시 시도해주세요.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
    },
  })
}

// ===== 항목 추가 =====
export function useAddChecklistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      teamId: TeamId
      section: ChecklistItem['section']
      content: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      const { data, error } = await client
        .from('checklist_items')
        .insert({
          team_id: input.teamId,
          section: input.section,
          content: input.content,
          completed: false,
          sort_order: 999,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
      toast.success('항목이 추가되었습니다.')
    },
    onError: () => toast.error('추가 실패. 다시 시도해주세요.'),
  })
}

// ===== 항목 삭제 (soft-delete) =====
export function useDeleteChecklistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('checklist_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
      toast.success('항목이 삭제되었습니다.')
    },
    onError: () => toast.error('삭제 실패. 다시 시도해주세요.'),
  })
}
```

- [ ] **Step 2: sonner Toaster 추가**

`app/providers.tsx`에 Toaster 추가:

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: true,
          },
        },
      })
  )
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd sportsday-hub
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 체크리스트 mutation 레이어 + Toaster (Plan B Task 5)"
```

---

## Task 6: mutation 레이어 — 결정/마일스톤/이슈/팀

**Files:**
- Create: `sportsday-hub/lib/mutations/decisions.ts`
- Create: `sportsday-hub/lib/mutations/milestones.ts`
- Create: `sportsday-hub/lib/mutations/issues.ts`
- Create: `sportsday-hub/lib/mutations/teams.ts`

**Interfaces:**
- Consumes: Task 4의 클라이언트, Task 3의 queryKeys
- Produces: `useUpdateDecision`, `useToggleMilestone`, `useAddIssue`, `useUpdateIssue`, `useDeleteIssue`, `useUpdateGuidelineSection`.

- [ ] **Step 1: 결정 mutation**

`lib/mutations/decisions.ts` 생성:

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { Decision, DecisionStatus } from '@/lib/types/models'

export function useUpdateDecision() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      status?: DecisionStatus
      currentValue?: string
      notes?: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      const update: Record<string, unknown> = {}
      if (input.status !== undefined) update.status = input.status
      if (input.currentValue !== undefined) update.current_value = input.currentValue
      if (input.notes !== undefined) update.notes = input.notes
      const { data, error } = await client
        .from('decisions')
        .update(update)
        .eq('id', input.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.decisions })
      const prev = queryClient.getQueryData<Decision[]>(queryKeys.decisions)
      if (prev) {
        queryClient.setQueryData<Decision[]>(
          queryKeys.decisions,
          prev.map((d) =>
            d.id === input.id
              ? {
                  ...d,
                  status: input.status ?? d.status,
                  current_value: input.currentValue ?? d.current_value,
                  notes: input.notes ?? d.notes,
                }
              : d
          )
        )
      }
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.decisions, ctx.prev)
      toast.error('저장 실패. 다시 시도해주세요.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions })
    },
  })
}
```

- [ ] **Step 2: 마일스톤 mutation**

`lib/mutations/milestones.ts` 생성:

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { Milestone } from '@/lib/types/models'

export function useToggleMilestone() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (milestone: Milestone) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('milestones')
        .update({ completed: !milestone.completed })
        .eq('id', milestone.id)
      if (error) throw error
    },
    onMutate: async (milestone) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.milestones })
      const prev = queryClient.getQueryData<Milestone[]>(queryKeys.milestones)
      if (prev) {
        queryClient.setQueryData<Milestone[]>(
          queryKeys.milestones,
          prev.map((m) =>
            m.id === milestone.id
              ? { ...m, completed: !m.completed }
              : m
          )
        )
      }
      return { prev }
    },
    onError: (_err, _m, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.milestones, ctx.prev)
      toast.error('저장 실패. 다시 시도해주세요.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones })
    },
  })
}
```

- [ ] **Step 3: 이슈 mutation**

`lib/mutations/issues.ts` 생성:

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { TeamId, IssueStatus } from '@/lib/types/models'

export function useAddIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      teamId: TeamId | null
      title: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      const { data, error } = await client
        .from('issues')
        .insert({
          team_id: input.teamId,
          title: input.title,
          status: 'open',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      toast.success('이슈가 추가되었습니다.')
    },
    onError: () => toast.error('추가 실패.'),
  })
}

export function useUpdateIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      status?: IssueStatus
      title?: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      const update: Record<string, unknown> = {}
      if (input.status !== undefined) update.status = input.status
      if (input.title !== undefined) update.title = input.title
      const { error } = await client
        .from('issues')
        .update(update)
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
    },
    onError: () => toast.error('저장 실패.'),
  })
}

export function useDeleteIssue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from('issues')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      toast.success('이슈가 삭제되었습니다.')
    },
    onError: () => toast.error('삭제 실패.'),
  })
}
```

- [ ] **Step 4: 팀 지침 섹션 mutation**

`lib/mutations/teams.ts` 생성:

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import type { Team } from '@/lib/types/models'

export function useUpdateGuidelineSection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      teamId: string
      sectionId: string
      contentMd: string
    }) => {
      const client = createClient()
      await ensureContext(client)
      // 현재 팀 데이터 조회 → 섹션 업데이트 → 저장
      const { data: team, error: fetchErr } = await client
        .from('teams')
        .select('*')
        .eq('id', input.teamId)
        .single()
      if (fetchErr) throw fetchErr
      if (!team) throw new Error('팀을 찾을 수 없습니다')

      const sections = (team.guideline_doc?.sections ?? []).map((s: { id: string; content_md: string }) =>
        s.id === input.sectionId
          ? { ...s, content_md: input.contentMd }
          : s
      )
      const { error } = await client
        .from('teams')
        .update({
          guideline_doc: { sections },
        })
        .eq('id', input.teamId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams })
      toast.success('지침이 저장되었습니다.')
    },
    onError: () => toast.error('저장 실패. 다시 시도해주세요.'),
  })
}
```

- [ ] **Step 5: 타입 체크**

```bash
cd sportsday-hub
npx tsc --noEmit
```

- [ ] **Step 6: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 결정/마일스톤/이슈/팀 mutation 레이어 (Plan B Task 6)"
```

---

## Task 7: 편집 컴포넌트 — 체크박스 + 셀렉트 + 인라인 텍스트

**Files:**
- Create: `sportsday-hub/components/editor/editable-checkbox.tsx`
- Create: `sportsday-hub/components/editor/decision-status-select.tsx`
- Create: `sportsday-hub/components/editor/inline-text-edit.tsx`
- Create: `sportsday-hub/components/editor/add-item-button.tsx`

**Interfaces:**
- Consumes: Task 5, 6의 mutation 훅
- Produces: 재사용 가능한 편집 컴포넌트들. Task 8, 9에서 기존 컴포넌트 교체 시 사용.

- [ ] **Step 1: 편집 가능 체크박스**

`components/editor/editable-checkbox.tsx` 생성:

```typescript
'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { useToggleCheck } from '@/lib/mutations/checklist'
import { useToggleMilestone } from '@/lib/mutations/milestones'
import type { ChecklistItem, Milestone } from '@/lib/types/models'

export function EditableChecklistCheckbox({
  item,
}: {
  item: ChecklistItem
}) {
  const toggle = useToggleCheck()
  return (
    <Checkbox
      checked={item.completed}
      onCheckedChange={() => toggle.mutate(item)}
      disabled={toggle.isPending}
    />
  )
}

export function EditableMilestoneCheckbox({
  milestone,
}: {
  milestone: Milestone
}) {
  const toggle = useToggleMilestone()
  return (
    <Checkbox
      checked={milestone.completed}
      onCheckedChange={() => toggle.mutate(milestone)}
      disabled={toggle.isPending}
    />
  )
}
```

- [ ] **Step 2: 결정 상태 셀렉트**

`components/editor/decision-status-select.tsx` 생성:

```typescript
'use client'

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { useUpdateDecision } from '@/lib/mutations/decisions'
import {
  DECISION_STATUS_LABEL,
  type DecisionStatus,
  type Decision,
} from '@/lib/types/models'

const STATUSES: DecisionStatus[] = [
  'confirmed',
  'discussing',
  'pending',
  'deferred',
]

export function DecisionStatusSelect({ decision }: { decision: Decision }) {
  const update = useUpdateDecision()

  return (
    <Select
      value={decision.status}
      onValueChange={(value) =>
        update.mutate({
          id: decision.id,
          status: value as DecisionStatus,
        })
      }
    >
      <SelectTrigger className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {DECISION_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

> **주의:** shadcn v4.16의 Select는 base-ui 기반이므로 `onValueChange` 대신 다른 prop일 수 있음. 컴포넌트를 Read하여 정확한 prop명 확인 후 조정. 보통 `onValueChange` 또는 `value` + `onChange` 패턴.

- [ ] **Step 3: 인라인 텍스트 편집**

`components/editor/inline-text-edit.tsx` 생성:

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function InlineTextEdit({
  value,
  onSave,
  placeholder = '입력...',
  multiline = false,
}: {
  value: string | null
  onSave: (value: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const handleSave = () => {
    onSave(draft.trim())
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left text-sm hover:bg-muted rounded px-1 -mx-1"
      >
        {value || <span className="text-muted-foreground italic">{placeholder}</span>}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !multiline) handleSave()
          if (e.key === 'Escape') handleCancel()
        }}
        className="h-8"
      />
      <Button size="icon-xs" variant="ghost" onClick={handleSave}>
        <Check className="h-3 w-3" />
      </Button>
      <Button size="icon-xs" variant="ghost" onClick={handleCancel}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: 항목 추가 버튼**

`components/editor/add-item-button.tsx` 생성:

```typescript
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function AddItemButton({
  onAdd,
  placeholder = '새 항목...',
  label = '추가',
}: {
  onAdd: (content: string) => void
  placeholder?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const handleAdd = () => {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      setValue('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1 h-4 w-4" />
        {label}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
          if (e.key === 'Escape') {
            setValue('')
            setOpen(false)
          }
        }}
        autoFocus
        className="h-8"
      />
      <Button size="sm" onClick={handleAdd}>
        추가
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setValue('')
          setOpen(false)
        }}
      >
        취소
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Select 컴포넌트 API 확인 및 조정**

```bash
cd sportsday-hub
head -30 components/ui/select.tsx
```

base-ui Select의 정확한 props 확인. `onValueChange`가 아닌 경우 `decision-status-select.tsx`의 prop명 조정.

- [ ] **Step 6: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 편집 컴포넌트 (체크박스/셀렉트/인라인텍스트/추가버튼) (Plan B Task 7)"
```

---

## Task 8: 기존 화면에 편집 기능 통합 — 대시보드 + 팀 워크스페이스

**Files:**
- Modify: `sportsday-hub/components/dashboard/decision-tracker.tsx`
- Modify: `sportsday-hub/components/team/checklist-panel.tsx`
- Modify: `sportsday-hub/components/team/milestone-panel.tsx`
- Modify: `sportsday-hub/components/team/issue-panel.tsx`
- Modify: `sportsday-hub/components/checklist/unified-checklist.tsx`

**Interfaces:**
- Consumes: Task 7의 편집 컴포넌트, Task 5, 6의 mutations
- Produces: 모든 화면에서 편집 가능. 체크 토글, 결정 상태 변경, 항목 추가/삭제.

- [ ] **Step 1: 결정 추적표에 편집 통합**

`components/dashboard/decision-tracker.tsx` 수정:
- `StatusBadge`를 `DecisionStatusSelect`로 교체
- `current_value`를 `InlineTextEdit`로 교체
- `'use client'` 추가

기존 결정 행의 StatusBadge 부분을 찾아 DecisionStatusSelect로 교체하고, current_value 표시 부분을 InlineTextEdit로 교체. 결정 추적표는 클라이언트 컴포넌트로 전환 (`'use client'` 추가).

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { DecisionStatusSelect } from '@/components/editor/decision-status-select'
import { InlineTextEdit } from '@/components/editor/inline-text-edit'
import { useUpdateDecision } from '@/lib/mutations/decisions'
import type { Decision } from '@/lib/types/models'

export function DecisionTracker({ decisions }: { decisions: Decision[] }) {
  const updateDecision = useUpdateDecision()

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
                  <InlineTextEdit
                    value={d.current_value}
                    placeholder="미정"
                    onSave={(value) =>
                      updateDecision.mutate({
                        id: d.id,
                        currentValue: value,
                      })
                    }
                  />
                </div>
                <DecisionStatusSelect decision={d} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 팀 체크리스트 패널 편집 가능화**

`components/team/checklist-panel.tsx` 수정:
- `'use client'` 추가
- `<Checkbox checked={item.completed} disabled />`를 `<EditableChecklistCheckbox item={item} />`로 교체
- 각 섹션 하단에 `<AddItemButton>` 추가
- 항목별 삭제 버튼 추가

`'use client'` 추가 후, 각 체크박스를 EditableChecklistCheckbox로 교체. 섹션별 completed 카운트는 props로 받은 items에서 계산 (낙관적 업데이트가 queryClient 캐시를 갱신하므로 부모에서 re-render됨).

체크리스트 패널은 클라이언트 컴포넌트로 전환. 팀 ID를 prop으로 받아 AddItemButton에서 사용.

- [ ] **Step 3: 마일스톤 패널 편집 가능화**

`components/team/milestone-panel.tsx` 수정:
- `'use client'` 추가
- `<Checkbox checked={m.completed} disabled />`를 `<EditableMilestoneCheckbox milestone={m} />`로 교체

- [ ] **Step 4: 이슈 패널 편집 가능화**

`components/team/issue-panel.tsx` 수정:
- `'use client'` 추가
- 상태 배지를 클릭 가능한 Select로 교체 (또는 cycle 버튼)
- 이슈 추가 버튼 + 삭제 버튼 추가

- [ ] **Step 5: 통합 체크리스트 체크 토글 활성화**

`components/checklist/unified-checklist.tsx` 수정:
- `<Checkbox checked={item.completed} disabled />`를 `<EditableChecklistCheckbox item={item} />`로 교체

- [ ] **Step 6: team-tabs.tsx에서 props 조정**

`components/team/team-tabs.tsx`에서 `teamId`를 checklist-panel, milestone-panel, issue-panel에 추가 전달 (항목 추가에 필요).

- [ ] **Step 7: 타입 체크 + 빌드**

```bash
cd sportsday-hub
npx tsc --noEmit && npm run build
```

- [ ] **Step 8: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 대시보드/팀 워크스페이스 편집 기능 통합 (Plan B Task 8)"
```

---

## Task 9: 마크다운 편집 모달 + 지침 뷰어 통합

**Files:**
- Create: `sportsday-hub/components/editor/markdown-edit-dialog.tsx`
- Modify: `sportsday-hub/components/team/guideline-viewer.tsx`

**Interfaces:**
- Consumes: `useUpdateGuidelineSection` from Task 6, `MarkdownRenderer`
- Produces: 섹션별 [편집] 버튼 → 모달에서 마크다운 편집 + 미리보기.

- [ ] **Step 1: 마크다운 편집 모달**

`components/editor/markdown-edit-dialog.tsx` 생성:

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/lib/markdown/renderer'

export function MarkdownEditDialog({
  open,
  onClose,
  title,
  initialContent,
  onSave,
}: {
  open: boolean
  onClose: () => void
  title: string
  initialContent: string
  onSave: (content: string) => void
}) {
  const [content, setContent] = useState(initialContent)

  const handleSave = () => {
    onSave(content)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title} 편집</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 min-h-[400px]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              마크다운
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-[400px] font-mono text-sm"
            />
          </div>
          <div className="space-y-2 overflow-y-auto">
            <label className="text-sm font-medium text-muted-foreground">
              미리보기
            </label>
            <div className="border rounded-md p-4 h-[400px] overflow-y-auto">
              <MarkdownRenderer content={content} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 지침 뷰어에 편집 버튼 추가**

`components/team/guideline-viewer.tsx` 수정 — 각 섹션에 [편집] 버튼 추가, 클릭 시 MarkdownEditDialog 열기:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { MarkdownRenderer } from '@/lib/markdown/renderer'
import { MarkdownEditDialog } from '@/components/editor/markdown-edit-dialog'
import { useUpdateGuidelineSection } from '@/lib/mutations/teams'
import type { Team, TeamId } from '@/lib/types/models'

interface GuidelineSection {
  id: string
  title: string
  order: number
  content_md: string
}

export function GuidelineViewer({
  team,
  teamId,
}: {
  team: Team
  teamId: TeamId
}) {
  const [editingSection, setEditingSection] = useState<GuidelineSection | null>(null)
  const updateSection = useUpdateGuidelineSection()

  const sections = (team.guideline_doc?.sections ?? []).sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setEditingSection(section)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
          <MarkdownRenderer content={section.content_md} />
        </section>
      ))}

      {editingSection && (
        <MarkdownEditDialog
          open={!!editingSection}
          onClose={() => setEditingSection(null)}
          title={editingSection.title}
          initialContent={editingSection.content_md}
          onSave={(content) =>
            updateSection.mutate({
              teamId,
              sectionId: editingSection.id,
              contentMd: content,
            })
          }
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: team-tabs.tsx에서 teamId 전달**

`components/team/team-tabs.tsx`에서 `<GuidelineViewer team={team} teamId={team.id} />`로 수정.

- [ ] **Step 4: 타입 체크 + 빌드**

```bash
cd sportsday-hub
npx tsc --noEmit && npm run build
```

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 마크다운 편집 모달 + 지침 뷰어 통합 (Plan B Task 9)"
```

---

## Task 10: 변경 이력 조회 + 휴지통 + 최종 배포

**Files:**
- Create: `sportsday-hub/components/history/audit-log-dialog.tsx`
- Create: `sportsday-hub/app/trash/page.tsx`
- Create: `sportsday-hub/components/trash/trash-view.tsx`
- Modify: `sportsday-hub/components/layout/app-sidebar.tsx` (휴지통 링크 추가)

**Interfaces:**
- Consumes: Task 3의 audit 쿼리, Task 5, 6의 mutations
- Produces: 항목별 변경 이력 조회, 휴지통 페이지(삭제 항목 조회 + 복원). Plan B 완성.

- [ ] **Step 1: 변경 이력 다이얼로그**

`components/history/audit-log-dialog.tsx` 생성:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getAuditForRecord } from '@/lib/queries/audit'
import { queryKeys } from '@/lib/queries/keys'
import { AUDIT_ACTION_LABEL } from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

export function AuditLogDialog({
  open,
  onClose,
  table,
  recordId,
  title,
}: {
  open: boolean
  onClose: () => void
  table: string
  recordId: string
  title: string
}) {
  const { data: logs = [] } = useQuery({
    queryKey: queryKeys.auditForRecord(table, recordId),
    queryFn: () => getAuditForRecord(table, recordId),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>변경 이력 — {title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              변경 기록이 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-md border p-2 text-sm"
                >
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">
                    {AUDIT_ACTION_LABEL[log.action]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{log.changed_by}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(log.created_at!), 'yyyy. M. d. a h:mm', {
                        locale: ko,
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
```

> **참고:** `getAuditForRecord`는 서버 쿼리지만, useQuery로 클라이언트에서 호출하기 위해 서버 클라이언트를 사용. 이는 RSC가 아니라 클라이언트 fetch이므로 `createClient`를 브라우저용으로 조정하거나, Route Handler를 통해 호출해야 함. 가장 간단한 방법: audit 쿼리도 브라우저 클라이언트를 사용하는 버전을 만들거나, 클라이언트에서 직접 fetch.

**간소화 대안:** 클라이언트에서 직접 Supabase 호출:

```typescript
// lib/queries/audit.ts에 클라이언트용 추가:
import { createBrowserClient } from '@supabase/ssr'  // 또는 createClient from client.ts

export async function getAuditForRecordClient(
  table: string,
  recordId: string
): Promise<AuditLog[]> {
  const client = createBrowserClient<Database>(URL, KEY)
  const { data, error } = await client
    .from('audit_log')
    .select('*')
    .eq('table_name', table)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}
```

AuditLogDialog에서는 이 클라이언트용 함수 사용.

- [ ] **Step 2: 휴지통 페이지**

`app/trash/page.tsx` 생성 (서버 컴포넌트):

```typescript
import { TrashView } from '@/components/trash/trash-view'

export default async function TrashPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">휴지통</h1>
        <p className="text-sm text-muted-foreground">
          삭제된 항목을 30일 내에 복원할 수 있습니다.
        </p>
      </div>
      <TrashView />
    </div>
  )
}
```

- [ ] **Step 3: 휴지통 뷰 컴포넌트**

`components/trash/trash-view.tsx` 생성:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries/keys'
import type { ChecklistItem, Issue } from '@/lib/types/models'

export function TrashView() {
  const [items, setItems] = useState<(ChecklistItem | Issue)[]>([])
  const [loaded, setLoaded] = useState(false)
  const queryClient = useQueryClient()

  const loadTrash = async () => {
    const client = createClient()
    const [checklist, issues] = await Promise.all([
      client.from('checklist_items').select('*').not('deleted_at', 'is', null),
      client.from('issues').select('*').not('deleted_at', 'is', null),
    ])
    setItems([...(checklist.data ?? []), ...(issues.data ?? [])])
    setLoaded(true)
  }

  if (!loaded) {
    return <Button onClick={loadTrash}>삭제된 항목 불러오기</Button>
  }

  const handleRestore = async (table: string, id: string) => {
    const client = createClient()
    const { error } = await client
      .from(table)
      .update({ deleted_at: null })
      .eq('id', id)
    if (error) {
      toast.error('복원 실패')
    } else {
      toast.success('복원되었습니다.')
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      loadTrash()
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">휴지통이 비어 있습니다.</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-md border p-3"
        >
          <span className="min-w-0 flex-1 text-sm">
            {('content' in item ? item.content : '') ||
              ('title' in item ? item.title : '')}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              handleRestore(
                'content' in item ? 'checklist_items' : 'issues',
                item.id
              )
            }
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            복원
          </Button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 사이드바에 휴지통 링크 추가**

`components/layout/app-sidebar.tsx`의 `NAV_ITEMS`에 추가:

```typescript
import { Trash2 } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/timeline', label: '타임라인', icon: CalendarClock },
  { href: '/checklists', label: '체크리스트', icon: CheckSquare },
  { href: '/trash', label: '휴지통', icon: Trash2 },
]
```

- [ ] **Step 5: 체크리스트/이슈 패널에 [이력] 버튼 추가 (선택)**

`components/team/checklist-panel.tsx`에서 각 항목에 히스토리 아이콘 버튼 추가 → AuditLogDialog 열기. 같은 패턴을 이슈 패널에도 적용. (이 단계는 시간이 허락하면 추가, 핵심 기능은 아님.)

- [ ] **Step 6: 타입 체크 + 빌드**

```bash
cd sportsday-hub
npx tsc --noEmit && npm run build
```

- [ ] **Step 7: 프로덕션 마이그레이션 적용**

```bash
cd sportsday-hub
npx supabase db push
```

`0003_audit_softdelete.sql`이 클라우드 DB에 적용되는지 확인.

- [ ] **Step 8: Vercel 재배포**

GitHub에 푸시하면 Vercel이 자동 재배포:

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git push origin main
```

- [ ] **Step 9: 프로덕션 검증**

배포 완료 후 [sportsday-hub.vercel.app](https://sportsday-hub.vercel.app)에서:
- 체크박스 클릭 시 토글 + 토스트 표시
- 결정 상태 드롭다운 변경
- 닉네임 입력 모달 동작
- 휴지통 페이지 접속
- 항목 추가/삭제 후 새로고침 시 유지

- [ ] **Step 10: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 변경 이력 + 휴지통 + Plan B 완성 (최종 배포)"
```

---

## Plan B 완료 기준

- [ ] 닉네임 입력 모달이 첫 편집 시 나타남
- [ ] 체크박스 토글이 낙관적 업데이트로 작동 (실패 시 롤백 + 토스트)
- [ ] 결정 상태 변경 드롭다운 작동
- [ ] 마크다운 섹션 편집 모달 (분할 미리보기) 작동
- [ ] 체크리스트/이슈 항목 추가/삭제 작동
- [ ] audit_log에 변경 기록이 쌓임 (Supabase 대시보드에서 확인)
- [ ] 휴지통에서 삭제 항목 조회 + 복원 작동
- [ ] 프로덕션 배포 완료
