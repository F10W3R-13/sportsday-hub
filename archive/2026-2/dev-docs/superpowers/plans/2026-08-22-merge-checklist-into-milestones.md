# 체크리스트↔마일스톤 엔터티 병합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `checklist_items` 테이블을 `milestones` 테이블로 병합해 작업 엔터티를 하나로 통일하고, UI 라벨을 "체크리스트"로 통일한다.

**Architecture:** 마일스톤 테이블이 생존 테이블. `priority`/`source` 컬럼 추가 + `date` nullable 완화 후 체크리스트 행을 **원래 UUID 보존**하며 이관(인계 FK 재지정 불필요한 데이터 조작 최소화). 코드는 내부 식별자를 `Milestone*`로 유지해 변경 범위를 줄이고, 사용자 노출 문자열만 "체크리스트"로 바꾼다.

**Tech Stack:** Next.js(App Router), React 19, TypeScript, Tailwind v4, Supabase(Postgres), vitest

## Global Constraints

- 모든 명령은 `sportsday-hub/`에서 실행
- **코드 프리즈: 2026-09-12 ~ 09-20 (행사 주간) 작업 금지**
- 데이터 이관은 되돌릴 수 있게: 0018 마이그레이션 선두에서 백업 테이블 생성(`checklist_items_backup_0018`, `milestones_backup_0018`)
- 내부 타입·함수명은 `Milestone*` 유지(변경 범위 최소화). **사용자 노출 문자열만** "체크리스트"로 통일
- 이슈(Issue), 드라이브 파일(drive_files), 결정(decisions) 엔터티는 병합 대상 아님
- 검증 게이트: `npx tsc --noEmit`, `npm run lint`, `npx vitest run` — 매 Task 통과 필수
- Task 순서 엄수: DB(Task 1) → 타입(Task 2) → 헬퍼(Task 3) → 쿼리/뮤테이션(Task 4~5) → UI(Task 6~10). 중간 Task는 빌드가 깨진 상태로 끝날 수 있으나, **각 Task 종료 시점에 tsc 에러가 이전 Task보다 증가하지 않아야 함**

## 사전 결정사항 (모든 Task에 적용)

| 결정 | 내용 |
|---|---|
| 생존 테이블 | `milestones` |
| 스키마 변화 | `+ priority text null check(in high/medium/low)`, `+ source text null`, `date not null 해제` |
| 이관 방식 | `INSERT INTO milestones (id, ...) SELECT ci.id ...` — **UUID 보존**으로 `handoffs` FK 데이터 무변경 |
| 부모 마일스톤 | 유지(회의/산출물 자체 의미 보존). 자식들은 날짜를 물려받아 개별 행으로 편입 → 플랫 목록 |
| 트리거 | 0012의 `trg_sync_milestone_completion`/`recompute_milestone`/`sync_milestone_completion` DROP |
| 인계 FK | `handoffs.checklist_item_id` → 이름 변경 `item_id`, 참조를 `milestones(id)`로 |
| 동기화 메시지 | `'checklist-updated'`와 `'milestone-updated'` → `'tasks-updated'`로 통일 |
| 카테고리 기본값 | 이관되는 체크리스트 항목은 `category='deliverable'` |

---

### Task 1: DB 마이그레이션 0018

**Files:**
- Create: `supabase/migrations/0018_merge_checklist_into_milestones.sql`

**Interfaces:**
- Produces: `milestones(id, date nullable, title, team_id, category, completed, depends_on, sort_order, priority, source, created_at, updated_at, deleted_at)` / `handoffs.item_id → milestones(id)`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 0018: checklist_items를 milestones로 병합 (UUID 보존)
begin;

-- 백업 (롤백 가능성 대비)
create table public.checklist_items_backup_0018 as select * from public.checklist_items;
create table public.milestones_backup_0018 as select * from public.milestones;

-- 스키마 확장
alter table public.milestones
  add column if not exists priority text,
  add column if not exists source text;
alter table public.milestones
  add constraint milestones_priority_check check (priority in ('high','medium','low'));
alter table public.milestones alter column date drop not null;

-- 완료 자동 동기화 트리거 제거 (자식 테이블 소멸)
drop trigger if exists trg_sync_milestone_completion on public.checklist_items;
drop function if exists public.sync_milestone_completion();
drop function if exists public.recompute_milestone(uuid);

-- 체크리스트 항목 이관 (원래 UUID 유지 → handoffs FK 데이터 그대로 유효)
insert into public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order, priority, source, updated_at, deleted_at)
select ci.id,
       m.date,
       ci.content,
       ci.team_id,
       'deliverable',
       ci.completed,
       null::uuid[],
       ci.sort_order,
       ci.priority,
       ci.source,
       coalesce(ci.updated_at, now()),
       ci.deleted_at
from public.checklist_items ci
left join public.milestones_backup_0018 m on ci.milestone_id = m.id
on conflict (id) do nothing;

-- 인계 FK 재지향 (같은 UUID를 참조하므로 데이터 무변경)
alter table public.handoffs drop constraint if exists handoffs_checklist_item_id_fkey;
alter table public.handoffs rename column checklist_item_id to item_id;
alter table public.handoffs
  add constraint handoffs_item_id_fkey
  foreign key (item_id) references public.milestones(id) on delete set null;

-- 구 테이블 제거 (FK·트리거는 drop table이 함께 정리)
drop table public.checklist_items;

commit;
```

주의: 실제 FK 제약 이름이 다를 수 있음 — 적용 전 `\d handoffs` 또는 information_schema로 확인하고 `drop constraint if exists`에 실제 이름 병기. `updated_at` 자동 갱신 트리거(touch_updated_at)는 milestones에 이미 존재하므로 그대로.

- [ ] **Step 2: 로컬/스테이징 DB 적용 + 검증 SQL**

검증 쿼리(적용 후 실행):

```sql
-- 건수 일치: 이관 후 milestones = 원래 마일스톤 + 살아있는 체크리스트
select
  (select count(*) from milestones_backup_0018) as orig_ms,
  (select count(*) from milestones) as now_ms,
  (select count(*) from checklist_items_backup_0018 where deleted_at is null) as live_ci;
-- 기대: now_ms >= orig_ms + live_ci

-- 인계 FK 유효성: 끊긴 참조 없어야 함
select count(*) from handoffs h
left join milestones m on h.item_id = m.id
where h.item_id is not null and m.id is null;  -- 기대: 0
```

Run: 프로젝트의 Supabase 마이그레이션 적용 절차 따름 (`npx supabase db push` 또는 대시보드 SQL 에디터 — 기존 워크플로우 확인 후 사용)

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0018_merge_checklist_into_milestones.sql
git commit -m "feat: checklist_items를 milestones로 병합하는 DB 마이그레이션"
```

---

### Task 2: 타입 통합

**Files:**
- Modify: `lib/types/models.ts`
- Modify: `lib/types/database.ts`

**Interfaces:**
- Produces: `Milestone` = `{ id, date: string|null, title, team_id: TeamId|null, category, completed, depends_on: string[]|null, sort_order, priority: 'high'|'medium'|'low'|null, source: string|null, updated_at, deleted_at|null }`. `ChecklistItem` export **제거**.
- Produces: `HandoffItem`의 체크리스트 연결 필드가 `checklist_content` → `item_title`로 변경 (queries/handoffs.ts와 함께 Task 4에서 소비부 수정)

- [ ] **Step 1: milestoneSchema 확장**

```ts
export const milestoneSchema = z.object({
  id: z.string(),
  date: z.string().nullable(),          // null = 상시
  title: z.string(),
  team_id: z.string().nullable(),
  category: z.enum(['meeting', 'deliverable', 'event']),
  completed: z.boolean(),
  depends_on: z.array(z.string()).nullable().optional(),
  sort_order: z.number().optional(),
  priority: z.enum(['high', 'medium', 'low']).nullable().optional(),
  source: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
})
```

- [ ] **Step 2: checklistItemSchema 및 관련 export 삭제**

`checklistItemSchema`, `ChecklistItem` 타입 export 제거. `PRIORITY` 상수가 checklist 전용이면 models.ts 내 위치만 이동(이름 유지).

- [ ] **Step 3: handoffSchema 필드명 변경**

`checklist_item_id` → `item_id`, `checklist_content` → `item_title`, `checklist_team_id` → `item_team_id`.

- [ ] **Step 4: database.ts 갱신**

`Tables['checklist_items']` 제거, `Tables['milestones']` Row/Insert에 신규 컬럼 반영, `Tables['handoffs']`에 `item_id` 반영.

- [ ] **Step 5: 커밋**

```bash
git commit -m "refactor: 엔터티 통합을 위한 타입 병합 (Milestone 확장, ChecklistItem 제거)"
```

(tsc는 이후 Task까지 임시로 에러 있음 — 에러 목록이 Task 3~10 범위 내인지만 확인)

---

### Task 3: 헬퍼 갱신 (긴급도·진행률·완료 판정) — TDD

**Files:**
- Modify: `lib/milestones-urgency.ts`
- Modify: `lib/progress.ts`
- Delete: `lib/milestone-completion.ts`
- Test: `tests/milestones-urgency.test.ts`, `tests/progress.test.ts`
- Delete: `tests/milestone-completion.test.ts`

**Interfaces:**
- Produces: `sortByUrgency(milestones: Milestone[], now?): { milestone: Milestone; tier: 'overdue'|'today'|'upcoming'|'undated'; daysFromToday: number }[]` — `date: null` 항목은 tier `'undated'`, 맨 뒤 정렬
- Produces: `computeProgress(items: Milestone[])` — 시그니처 동일, 입력 타입만 교체

- [ ] **Step 1: 실패 테스트 추가** — `tests/milestones-urgency.test.ts`에:

```ts
it('date가 null인 항목은 undated tier로 맨 뒤에 정렬된다', () => {
  const tasks = [
    { ...baseTask, id: 'a', date: '2099-01-01' },
    { ...baseTask, id: 'b', date: null },
    { ...baseTask, id: 'c', date: '2000-01-01' }, // overdue
  ]
  const sorted = sortByUrgency(tasks, new Date('2026-09-01'))
  expect(sorted.map((s) => s.milestone.id)).toEqual(['c', 'a', 'b'])
  expect(sorted[2].tier).toBe('undated')
})
```

- [ ] **Step 2: 실패 확인** → Run: `npx vitest run tests/milestones-urgency.test.ts` → FAIL
- [ ] **Step 3: 구현** — `milestones-urgency.ts`: `date` null 가드 추가

```ts
// sortByUrgency 내부: null date는 'undated' tier로 분류해 배열 맨 뒤로
const dated = milestones.filter((m): m is Milestone & { date: string } => m.date !== null)
const undated = milestones.filter((m) => m.date === null)
return [
  ...dated.map(...기존 분류 로직...),
  ...undated.map((m) => ({ milestone: m, tier: 'undated' as const, daysFromToday: Number.MAX_SAFE_INTEGER })),
]
```

소비부 호환: `TIER_LABEL` 등에서 `'undated'` 미처리 시 fallback 동작 확인(urgent-checklist는 Task 7에서 재작성).
- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: progress.ts 타입 교체** — `import type { ChecklistItem }` → `Milestone`, 함수 본문 무변경. `tests/progress.test.ts`도 동일 교체.
- [ ] **Step 6: milestone-completion.ts·테스트 삭제** (`git rm`)
- [ ] **Step 7: 커밋** `feat: 통합 엔터티 기준 긴급도·진행률 헬퍼 갱신`

---

### Task 4: 쿼리 레이어 통합

**Files:**
- Modify: `lib/queries/keys.ts`, `lib/queries/milestones.ts`, `lib/queries/handoffs.ts`
- Delete: `lib/queries/checklist.ts`

**Interfaces:**
- Produces: `getMilestones(): Promise<Milestone[]>`(deleted 제외), `getMilestonesByTeam(teamId)`, `getMilestoneById(id)` — 기존 시그니처 유지, 내부에 정렬 `(date nulls last, sort_order)` 추가
- Produces: `queryKeys.milestones`, `queryKeys.milestonesByTeam(id)` — `queryKeys.checklist*` 전부 제거

- [ ] **Step 1: keys.ts** — checklist 계열 key 제거, 필요 시 `milestonesAll` 추가
- [ ] **Step 2: queries/milestones.ts** — `getChecklistItems` 역할 흡수. 정렬 SQL: `.order('date', { nullsFirst: false }).order('sort_order')`
- [ ] **Step 3: queries/handoffs.ts** — 조인 수정:

```ts
.select(`*, from_team:teams!handoffs_from_team_id_fkey(*),
         to_team:teams!handoffs_to_team_id_fkey(*),
         item:milestones!handoffs_item_id_fkey(id, title, team_id)`)
```

매핑에서 `HandoffItem.item_title = item?.title ?? null`, `item_team_id = item?.team_id ?? null`.
- [ ] **Step 4: queries/checklist.ts 삭제** (`git rm`) — 호출부(app/page.tsx 등)는 Task 6~9에서 수정되므로 여기서 아직 남은 tsc 에러는 다음 Task 범위 확인
- [ ] **Step 5: 커밋** `refactor: 쿼리 레이어를 단일 엔터티로 통합`

---

### Task 5: 뮤테이션 통합 + 체크박스 단일화 + 동기화 메시지

**Files:**
- Modify: `lib/mutations/milestones.ts`, `components/editor/editable-checkbox.tsx`, `lib/sync.ts`, `lib/tab-sync` 리스너(사용처 검색)
- Delete: `lib/mutations/checklist.ts`

**Interfaces:**
- Produces: `useToggleMilestone()`, `useCreateMilestone()`, `useDeleteMilestone()` — 기존 checklist 훅의 optimistic+onError 원복 패턴 이식
- Produces: `EditableTaskCheckbox({ task, label? })` (파일 export명 교체)
- Produces: `SyncMessage`에 `'tasks-updated'`

- [ ] **Step 1: mutations/milestones.ts에 create/delete 추가** — 기존 `mutations/checklist.ts`의 `useAddChecklistItem/useDeleteChecklistItem` 로직을 테이블명·타입만 바꿔 이식. invalidate는 `queryKeys.milestones*`.
- [ ] **Step 2: editable-checkbox.tsx 단일화**

```tsx
export function EditableTaskCheckbox({
  task,
  label,
}: {
  task: Milestone
  label?: string
}) {
  // 기존 EditableChecklistCheckbox의 localChecked 낙관 + onError 원복 패턴 그대로
  return (
    <Checkbox
      checked={localChecked}
      onCheckedChange={handleChange}
      disabled={toggle.isPending}
      aria-label={label ?? `${task.title} 완료 여부`}
    />
  )
}
```

두 구컴포넌트(`EditableChecklistCheckbox`, `EditableMilestoneCheckbox`)는 삭제.
- [ ] **Step 3: sync.ts** — `'checklist-updated' | 'milestone-updated'` → `'tasks-updated'`. `notifyTabs` 호출부 전수 교체(grep `notifyTabs`).
- [ ] **Step 4: 커밋** `refactor: 뮤테이션·체크박스·탭동기화를 단일 엔터티로 통합`

---

### Task 6: 타임라인 재작성

**Files:**
- Modify: `components/timeline/timeline-list.tsx`, `app/timeline/page.tsx`

**Interfaces:**
- Consumes: `getMilestones()` (Task 4), `EditableTaskCheckbox` (Task 5), `PriorityBadge`, `TeamBadge`, `sortByUrgency` 미사용(여기선 날짜순)
- Produces: `TimelineList({ tasks, teams })` — props명 교체

- [ ] **Step 1: timeline-list.tsx 재작성 (핵심 로직)**

```tsx
export function TimelineList({ tasks, teams }: { tasks: Milestone[]; teams: Team[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const filtered = useMemo(
    () => tasks.filter((t) => (filter === 'all' ? true : filter === 'complete' ? t.completed : !t.completed)),
    [tasks, filter],
  )
  // 월 그룹: date 있는 것 yyyy-MM 기준 / 없는 것 '상시' 버킷 (맨 앞)
  const byMonth = useMemo(() => {
    const map = new Map<string, Milestone[]>()
    for (const t of filtered) {
      if (!t.date) continue
      const key = format(parseISO(t.date), 'yyyy-MM')
      map.set(key, [...(map.get(key) ?? []), t])
    }
    return map
  }, [filtered])
  const undated = filtered.filter((t) => !t.date)
  // 진행률: computeProgress(tasks)
  // 렌더: 진행률 바 → 필터(aria-pressed 유지) → 상시 버킷 → 월 섹션
  //   행 = EditableTaskCheckbox + 날짜(M/d, null이면 '상시') + PriorityBadge + title + TeamBadge
}
```

카테고리 배지(meeting/deliverable/event)는 유지. 하위 펼침(chevron)·`n/m` 집계 로직 제거 — 플랫 구조에서 불필요.
- [ ] **Step 2: app/timeline/page.tsx** — `getChecklistItems` 호출 제거, `<TimelineList tasks={await getMilestones()} teams={teams} />`
- [ ] **Step 3: 검증 + 커밋** `feat: 타임라인을 플랫 작업 목록으로 재작성`

---

### Task 7: 대시보드 위젯 통합

**Files:**
- Modify: `components/dashboard/urgent-checklist.tsx`, `app/page.tsx`
- Delete: `components/dashboard/upcoming-milestones.tsx`

**Interfaces:**
- Produces: `UrgentChecklist({ tasks, teams })` — sortByUrgency 결과 전체를 하나의 위젯으로: overdue/today 먼저, 이어서 다가오는 상위 표시(상위 8개). `excludeMilestoneIds` prop **제거**(중복 근원 자체 소멸)

- [ ] **Step 1: urgent-checklist.tsx 재작성** — `urgencyMap` 조인 로직 삭제, `sortByUrgency(tasks, now)` 직접 사용. 행 = 날짜 라벨(`tier`별: 지연 n일/오늘/n일 후/상시) + title + TeamBadge + 완료 체크박스(EditableTaskCheckbox). `undated` tier는 위젯에서 제외(상시는 타임라인 담당).
- [ ] **Step 2: app/page.tsx** — `getChecklistItems` 제거, `topMilestoneIds` 계산 제거, `UpcomingMilestones` 임포트/렌더 제거, grid에서 UrgentChecklist를 단독 섹션으로:

```tsx
      <div>
        <UrgentChecklist tasks={milestones} teams={teams} />
      </div>
```

- [ ] **Step 3: upcoming-milestones.tsx 삭제** (`git rm`)
- [ ] **Step 4: stats-cards.tsx** — `ChecklistItem` → `Milestone` 타입 교체만
- [ ] **Step 5: 검증 + 커밋** `feat: 대시보드 위젯을 단일 긴급 작업 위젯으로 통합`

---

### Task 8: 팀 페이지 통합

**Files:**
- Modify: `components/team/team-tabs.tsx`, `components/team/checklist-panel.tsx`
- Delete: `components/team/milestone-panel.tsx`
- Modify: `app/team/[id]/page.tsx`

**Interfaces:**
- Produces: `TeamTabs` props 축소 — `{ team, issues, driveFiles, tasks }` (checklist/milestones/allMilestones 3개 → tasks 1개)
- Produces: `ChecklistPanel({ tasks, teamId, focusItemId })` — 플랫 목록: 날짜순 정렬, 날짜 배지, PriorityBadge, 완료 토글, 추가/삭제 유지

- [ ] **Step 1: checklist-panel.tsx 재작성** — `milestone_id` Map 그룹핑·`shouldCompleteMilestone` 제거. 정렬 `(date nulls last, sort_order)`. 추가 폼은 기존 패턴 유지(필드: content, priority, date 선택 옵션).
- [ ] **Step 2: team-tabs.tsx** — "마일스톤" 탭 제거, "체크리스트" 탭 하나만. `computeProgress(checklist)` → `computeProgress(tasks)`.
- [ ] **Step 3: app/team/[id]/page.tsx** — `getMilestonesByTeam`/`getMilestones` 이원 호출 → `getMilestonesByTeam` 하나로.
- [ ] **Step 4: milestone-panel.tsx 삭제** (`git rm`)
- [ ] **Step 5: 검증 + 커밋** `feat: 팀 페이지를 단일 체크리스트 탭으로 통합`

---

### Task 9: 카카오 다이제스트 + 인계 + 휴지통 정리

**Files:**
- Modify: `lib/kakao-digest.ts`, `app/api/digest/today/route.ts`, `app/api/cron/kakao-digest/route.ts`
- Modify: `components/handoffs/handoff-form-dialog.tsx`, `components/handoffs/handoff-row.tsx`
- Modify: `components/trash/trash-view.tsx`

**요구사항:**
1. **kakao-digest**: 입력을 `{ tasks, handoffs, teams }`로 축소. `milestone_id → milestoneById` 조인·`coveredMissionIds` 중복 제거 로직 삭제 — `sortByUrgency(tasks)`에서 미완료+overdue/today 추출로 단순화. 두 route는 `.from('milestones')` 단일 쿼리로.
2. **handoffs**: `HandoffItem.checklist_content` → `item_title` 사용처 교체(handoff-row 표시부, form-dialog의 연결 Select — 옵션 목록을 `getMilestonesByTeam`에서 가져오도록 수정). `buildChecklistFocusUrl`은 URL 문자열이라 무수정.
3. **trash-view**: `TrashEntryKind = 'milestones' | 'issues'`, `.from('milestones').not('deleted_at', 'is', null)`, 복원 invalidate `queryKeys.milestones`, notifyTabs `'tasks-updated'`. 라벨 '체크리스트' 유지.

- [ ] Step 1~3 순서 구현 → **검증: `npx tsc --noEmit` 에러 0 (첫 전체 클린 시점)** → 커밋 `refactor: 다이제스트·인계·휴지통을 통합 엔터티 기준으로 정리`

---

### Task 10: UI 라벨 스윕 + 스크립트 갱신

**Files:**
- Modify: 사용자 노출 문자열 전수 — grep 대상: `"마일스톤"` in `components/**`, `app/**`
- Modify: `scripts/migrate-from-md.ts`

**요구사항:**
1. 사용자 노출 "마일스톤" → "체크리스트" 일괄 교체. 예외: `depends_on` 등 코드 식별자, 주석은 유지 가능. EmptyState 카피("마일스톤과 체크리스트가 없습니다" → "체크리스트가 없습니다") 포함.
2. `scripts/migrate-from-md.ts` — DELETE/INSERT를 단일 milestones 흐름으로: 문서의 회의/산출물 일정은 기존대로, 체크리스트 섹션은 `priority/source` 포함 milestones INSERT로 통합.
3. 커밋 `chore: UI 라벨을 체크리스트로 통일 및 시드 스크립트 갱신`

---

### Task 11: 테스트 정비 + 전체 검증

**Files:**
- Modify: `tests/kakao-digest.test.ts`(입력 축소 반영), `tests/sync.test.ts`('tasks-updated'), `tests/handoffs-query.test.ts`(조인 mock), `tests/checklist-focus-url.test.ts`(무변동 확인)
- Create: `tests/milestones-urgency.test.ts`의 undated 케이스는 Task 3에서 완료

**Steps:**
- [ ] 1. 위 테스트 갱신 후 `npx vitest run` — 전부 PASS
- [ ] 2. `npm run lint` — 클린
- [ ] 3. `npm run build` — 성공
- [ ] 4. 커밋 `test: 엔터티 통합 반영 테스트 정비`

---

### Task 12: 배포 후 검증

- [ ] main 병합 → Vercel 배포 → `/timeline`, `/team/<id>`, `/`, `/trash`, 카카오 digest API 수동 확인
- [ ] Supabase에서 검증 SQL(Task 1 Step 2) 재실행
- [ ] 이상 시 롤백 경로: 백업 테이블 2개 + 이전 커밋 revert

## 범위 밖

- 우선순위별 필터/정렬 UI 신규 개발 (기존 기능 이식만)
- `depends_on` 활용 기능 (애초 UI 없음)
- 이슈(Issue)·결정(Decisions) 엔터티 정리
