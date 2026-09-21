# 디자인 리뷰 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-08-21 디자인 리뷰에서 발견된 접근성·신뢰성·UX 결함 8건을 수정해 전 페이지를 3/4 이상으로 끌어올린다.

**Architecture:** shadcn/ui + Tailwind 기반 Next.js App Router 앱. 대부분 컴포넌트 레벨 소규모 수정이며, 순수 로직(dedupe)은 `lib/file-feed.ts` 헬퍼로 추출해 vitest로 검증한다.

**Tech Stack:** Next.js(App Router), React 19, TypeScript, Tailwind v4, vitest

## Global Constraints

- 모든 명령은 `sportsday-hub/` 디렉토리에서 실행
- 한국어 카피는 기존 톤 유지 ("~했습니다", "~할까요?")
- 기존 주석 스타일(한국어, 패턴 근거 명시) 준수
- 검증 명령: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`
- 커밋은 사용자가 명시적으로 요청한 경우에만 수행

---

### Task 1: 아이콘 링크에 aria-label 추가

**Files:**
- Modify: `components/drive/recent-file-row.tsx:47-57`
- Modify: `components/drive/file-list.tsx:85-95`

**Interfaces:**
- Produces: 없음 (마크업 속성만 추가)

- [ ] **Step 1: recent-file-row.tsx 외부 링크 수정**

```tsx
        <a
          href={file.web_view_link}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md p-2 hover:bg-muted transition-colors"
          title="드라이브에서 열기"
          aria-label={`${file.name} 드라이브에서 열기`}
        >
```

- [ ] **Step 2: file-list.tsx 외부 링크 수정**

file-list의 행은 `file.name` 사용 (동일 패턴):

```tsx
                <a
                  href={file.web_view_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md p-2 hover:bg-muted transition-colors"
                  title="드라이브에서 열기"
                  aria-label={`${file.name} 드라이브에서 열기`}
                >
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

---

### Task 2: 타임라인 체크박스 accessible name + 필터 aria-pressed

**Files:**
- Modify: `components/editor/editable-checkbox.tsx`
- Modify: `components/timeline/timeline-list.tsx:128-139, 308, 249`

**Interfaces:**
- Produces: `EditableChecklistCheckbox({ item, label })`, `EditableMilestoneCheckbox({ milestone, label })` — `label?: string`, 미전달 시 기존 동작 유지

- [ ] **Step 1: editable-checkbox.tsx에 label prop 추가**

두 컴포넌트 모두 동일하게:

```tsx
export function EditableChecklistCheckbox({
  item,
  label,
}: {
  item: ChecklistItem
  label?: string
}) {
```

Checkbox에 전달:

```tsx
  return (
    <Checkbox
      checked={localChecked}
      onCheckedChange={handleChange}
      disabled={toggle.isPending}
      aria-label={label ?? `${item.content} 완료 여부`}
    />
  )
```

`EditableMilestoneCheckbox`는 `aria-label={label ?? \`${milestone.title} 완료 여부\`}`.

- [ ] **Step 2: timeline-list.tsx 필터 버튼에 aria-pressed 추가**

```tsx
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-4 text-sm transition-colors sm:flex-none md:min-h-9 md:px-3 ${
```

- [ ] **Step 3: 타입 체크 + lint**

Run: `npx tsc --noEmit; npm run lint`
Expected: 에러 없음

---

### Task 3: 인계 행 안으로 편집/삭제 버튼 이동 + 저대비 수정

**Files:**
- Modify: `components/handoffs/handoff-row.tsx`
- Modify: `components/handoffs/handoffs-client.tsx:133-168`

**Interfaces:**
- Produces: `HandoffRow({ handoff, hintFile, actions? })` — `actions?: React.ReactNode`, 행 카드 내부 우측에 렌더링. 위젯(handoffs-widget)은 props 변경 없음.

- [ ] **Step 1: handoff-row.tsx에 actions prop 추가**

```tsx
export function HandoffRow({
  handoff,
  hintFile,
  actions,
}: {
  handoff: HandoffItem
  hintFile?: RecentFileItem | null
  actions?: React.ReactNode
}) {
```

행 카드 내부 `관련 항목` 링크 뒤에 추가 (`{focusUrl && ...}` 블록 다음):

```tsx
      {actions}
```

동시에 저대비 수정:
- 39행 `text-muted-foreground/40` → `text-muted-foreground`
- 64행 `text-muted-foreground/60` → `text-muted-foreground`

- [ ] **Step 2: handoffs-client.tsx 행 구조 재배치**

기존 checkbox + HandoffRow + 버튼 3형제 구조를 checkbox를 HandoffRow 앞에 두고 버튼은 actions로 전달:

```tsx
          {sorted.map((h) => (
            <div key={h.id} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={h.completed}
                onChange={() => handleToggle(h)}
                className="h-4 w-4 shrink-0 cursor-pointer"
                title="완료 토글"
                aria-label={`${h.title} 완료 여부`}
              />
              <div className="min-w-0 flex-1">
                <HandoffRow
                  handoff={h}
                  hintFile={latestByTeam.get(h.from_team_id)}
                  actions={
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground"
                        onClick={() => {
                          setEditing(h)
                          setFormOpen(true)
                        }}
                      >
                        편집
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground"
                        onClick={() => handleDelete(h)}
                      >
                        삭제
                      </Button>
                    </>
                  }
                />
              </div>
            </div>
          ))}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

---

### Task 4: 파일 피드 중복 제거 (헬퍼 + TDD)

**Files:**
- Modify: `lib/file-feed.ts` (헬퍼 추가)
- Test: `tests/file-feed-dedupe.test.ts` (신규)
- Modify: `components/drive/file-feed-client.tsx:39`

**Interfaces:**
- Consumes: `RecentFileItem` (`@/lib/types/models`)
- Produces: `dedupeRecentFiles(files: RecentFileItem[]): RecentFileItem[]` — `id` 우선, id 없으면 `name` 기준으로 그룹핑하고 `modified_time` 최신 1개만 남김. 입력 순서(최신순 정렬) 보존.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect } from 'vitest'
import { dedupeRecentFiles } from '@/lib/file-feed'
import type { RecentFileItem } from '@/lib/types/models'

function file(partial: Partial<RecentFileItem>): RecentFileItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    name: '파일',
    mime_type: 'application/pdf',
    team: { id: 't1', name: '기획관리팀', color: '#000' },
    web_view_link: null,
    modified_time: null,
    modified_by: null,
    created_time: null,
    ...(partial as RecentFileItem),
  } as RecentFileItem
}

describe('dedupeRecentFiles', () => {
  it('같은 이름의 중복 파일 중 최신 것만 남긴다', () => {
    const files = [
      file({ name: '가이드.md', modified_time: '2026-08-10T00:00:00Z' }),
      file({ name: '가이드.md', modified_time: '2026-08-19T00:00:00Z' }),
    ]
    const result = dedupeRecentFiles(files)
    expect(result).toHaveLength(1)
    expect(result[0].modified_time).toBe('2026-08-19T00:00:00Z')
  })

  it('다른 파일은 모두 유지한다', () => {
    const files = [
      file({ name: 'a.docx' }),
      file({ name: 'b.xlsx' }),
    ]
    expect(dedupeRecentFiles(files)).toHaveLength(2)
  })

  it('id가 같으면 하나로 합친다', () => {
    const files = [
      file({ id: 'x', name: '이름1', modified_time: '2026-08-01T00:00:00Z' }),
      file({ id: 'x', name: '이름2', modified_time: '2026-08-02T00:00:00Z' }),
    ]
    expect(dedupeRecentFiles(files)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/file-feed-dedupe.test.ts`
Expected: FAIL (dedupeRecentFiles 미정의)

- [ ] **Step 3: lib/file-feed.ts에 헬퍼 구현**

```ts
// 파일 피드에서 동일 파일(id 또는 이름) 중복 노출 제거 — 최근 수정본 우선
export function dedupeRecentFiles(files: RecentFileItem[]): RecentFileItem[] {
  const bestByKey = new Map<string, RecentFileItem>()
  const order: string[] = []
  for (const f of files) {
    const key = f.id ? `id:${f.id}` : `name:${f.name}`
    const prev = bestByKey.get(key)
    if (!prev) {
      order.push(key)
      bestByKey.set(key, f)
      continue
    }
    const prevT = prev.modified_time ?? ''
    const curT = f.modified_time ?? ''
    if (curT > prevT) bestByKey.set(key, f)
  }
  return order.map((k) => bestByKey.get(k)!)
}
```

(`import type { RecentFileItem }`가 이미 있는지 확인 후 없으면 추가)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/file-feed-dedupe.test.ts`
Expected: PASS 3개

- [ ] **Step 5: file-feed-client.tsx 적용**

39행을 변수 분리 버전으로 교체하고 import에 추가:

```tsx
import { parseTeamFilter, dedupeRecentFiles } from '@/lib/file-feed'
```

```tsx
  const filtered = teamFilter ? files.filter((f) => f.team.id === teamFilter) : files
  const visible = dedupeRecentFiles(filtered)
```

---

### Task 5: 대시보드 위젯 간 항목 중복 제거

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/dashboard/urgent-checklist.tsx`

**Interfaces:**
- Consumes: `sortByUrgency(milestones, now)` (`@/lib/milestones-urgency`) — UpcomingMilestones와 동일 함수
- Produces: `UrgentChecklist({ ..., excludeMilestoneIds? })` — `excludeMilestoneIds?: string[]`, 해당 마일스톤 소속 체크리스트 항목을 긴급 목록에서 제외

- [ ] **Step 1: urgent-checklist.tsx에 excludeMilestoneIds prop 추가**

```tsx
export function UrgentChecklist({
  checklist,
  milestones,
  teams,
  excludeMilestoneIds,
}: {
  checklist: ChecklistItem[]
  milestones: Milestone[]
  teams: Team[]
  excludeMilestoneIds?: string[]
}) {
```

`urgentAll` useMemo의 filter에 추가:

```tsx
    return checklist
      .filter(
        (c) =>
          !c.completed &&
          c.milestone_id &&
          !excludeMilestoneIds?.includes(c.milestone_id) &&
          urgencyMap.has(c.milestone_id),
      )
```

deps 배열에 `excludeMilestoneIds` 추가.

- [ ] **Step 2: app/page.tsx에서 상위 5개 마일스톤 id 계산 후 전달**

```tsx
import { sortByUrgency } from '@/lib/milestones-urgency'
```

DashboardPage 내부 (Promise.all 뒤):

```tsx
  // 대시보드 위젯 간 중복 방지 — UpcomingMilestones와 동일한 정렬로 상위 5개 마일스톤 id 산출
  const topMilestoneIds = sortByUrgency(milestones, new Date())
    .slice(0, 5)
    .map(({ milestone }) => milestone.id)
```

UrgentChecklist에 전달:

```tsx
        <UrgentChecklist
          checklist={checklist}
          milestones={milestones}
          teams={teams}
          excludeMilestoneIds={topMilestoneIds}
        />
```

- [ ] **Step 3: 타입 체크 + 전체 테스트**

Run: `npx tsc --noEmit; npx vitest run`
Expected: 에러 없음, 기존 테스트 PASS

---

### Task 6: 휴지통 자동 로드 + 로딩 스켈레톤 + 만료 잔여일

**Files:**
- Modify: `components/trash/trash-view.tsx`

- [ ] **Step 1: useEffect 자동 로드 + loading 상태 추가**

import 수정:

```tsx
import { useEffect, useState } from 'react'
```

상태 추가 및 자동 로드:

```tsx
  const [items, setItems] = useState<TrashEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    void loadTrash().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

loadTrash의 finally는 호출부에서 처리하므로 함수 내부 변경 없음.

- [ ] **Step 2: 로딩 스켈레톤 UI로 교체**

기존 `if (!loaded)` 블록(107행)을 교체:

```tsx
  if (!loaded || loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <p className="text-sm text-muted-foreground">삭제된 항목을 불러오는 중…</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[52px] animate-pulse rounded-md border bg-muted/40" />
        ))}
      </div>
    )
  }
```

- [ ] **Step 3: 만료 잔여일 배지 추가**

30일 복원 정책 기준 남은 일수 계산 유틸을 컴포넌트 위에 추가:

```tsx
const RETENTION_DAYS = 30

function daysLeft(deletedAt: string | null): number | null {
  if (!deletedAt) return null
  const deleted = Date.parse(deletedAt)
  if (Number.isNaN(deleted)) return null
  return Math.max(0, Math.ceil((deleted + RETENTION_DAYS * 86_400_000 - Date.now()) / 86_400_000))
}
```

행 렌더링의 삭제일 span 옆에 추가:

```tsx
            {(() => {
              const left = daysLeft(entry.deletedAt)
              if (left === null) return null
              return (
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                    left <= 7 ? 'bg-red-50 text-red-600' : 'bg-muted'
                  }`}
                >
                  복원 {left}일 남음
                </span>
              )
            })()}
```

- [ ] **Step 4: 타입 체크 + lint**

Run: `npx tsc --noEmit; npm run lint`
Expected: 에러 없음

---

### Task 7: 설정 페이지 "unknown" 계정 폴백

**Files:**
- Modify: `app/settings/page.tsx:26-37`

원인: `app/api/auth/google-callback/route.ts:31`에서 userInfo 조회 실패 시 email이 리터럴 `'unknown'`으로 저장됨. UI에서 unknown을 숨기고 안내로 대체.

- [ ] **Step 1: 연결 상태 표시 분기 추가**

```tsx
        {status.connected ? (
          <div className="space-y-2">
            <p className="text-sm text-green-600">
              ✓ 연결됨
              {status.email && status.email !== 'unknown'
                ? `: ${status.email}`
                : ' (계정 정보를 가져올 수 없습니다)'}
            </p>
```

- [ ] **Step 2: 재연결 링크에 확인 단계 추가 (서버 컴포넌트 제약상 인라인 confirm 불가)**

재연결 링크를 클라이언트 컴포넌트로 추출하지 않고, 링크 문구에 결과를 명시해 실수 방지:

```tsx
            <a
              href="/api/auth/google-connect"
              className="inline-block rounded-md border px-3 py-1 text-sm hover:bg-muted"
            >
              다른 계정으로 재연결 (현재 연결이 교체됩니다)
            </a>
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

---

### Task 8: 전체 검증

- [ ] **Step 1:** Run: `npx tsc --noEmit` — Expected: 에러 0
- [ ] **Step 2:** Run: `npm run lint` — Expected: 에러 0
- [ ] **Step 3:** Run: `npx vitest run` — Expected: 신규 포함 전체 PASS
- [ ] **Step 4:** Run: `npm run build` — Expected: 빌드 성공

## 범위 밖 (별도 처리 필요)

- 인계 "버스 탑승 명단" 무관 파일 매핑 버그 — `lib/handoff.ts`의 `latestFileByTeamMap` 로직과 데이터 원인 파악 필요, 데이터 레이어 이슈라 본 플랜에서 제외
- `/files` 수정자 표기 혼용(GitHub ID vs 실명) — 닉네임 프로바이더 정책 결정 필요
- `/team/[id]` 404 — 배포 상태 확인 선행
