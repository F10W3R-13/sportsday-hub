# 마일스톤 완료 optimistic UI (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 체크 토글 시 `ChecklistPanel`의 그룹 카운트(x/N)·완료 표시를 즉시 반영(저장 실패 시 화면 미리보기만 롤백, DB 미건드림).

**Architecture:** `ChecklistPanel`이 `optimisticOverrides` 맵을 들고 `effectiveItems`를 파생 → 카운트·완료표시·체크박스 모두 여기서 계산. 토글은 즉시 override 설정 → `useToggleCheck` mutation → 에러 시 override 제거(롤백) → SSR refresh 도착 시 override 정리.

**Tech Stack:** Next.js (RSC + 'use client'), TanStack Query (mutation만), shadcn `Checkbox`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-14-마일스톤-완료-optimistic-ui-design.md`

## Global Constraints

- DB 데이터를 건드리지 않음 — 본 Phase는 순수 UI(spec §3). 진실은 DB(Phase 1 트리거).
- `shouldCompleteMilestone`(기존 순수함수, `lib/milestone-completion.ts`) 재사용 — 새 규칙 코드 추가 안 함(이원화 부담 증가 없음, spec §7).
- `EditableChecklistCheckbox`(`components/editor/editable-checkbox.tsx`)와 타임라인은 **변경 금지** — blast radius 최소화(spec §4).
- 한글 경로에서 `pnpm`이 죽으므로 모든 스크립트는 `npm`/`npx`.
- RTL+jsdom 인프라가 없어 컴포넌트 동작은 **수동 검증**(spec §6). 자동 검증은 `tsc --noEmit` + 기존 `vitest` 회귀만.

## File Structure

| 파일 | 역할 | 작업 |
|------|------|------|
| `sportsday-hub/components/team/checklist-panel.tsx` | 체크리스트 패널 — optimistic override 도입, 제어 체크박스, 카운트·완료표시 즉시 반영 | Modify |
| `sportsday-hub/lib/milestone-completion.ts` | `shouldCompleteMilestone`(재사용, 변경 없음) | 변경 없음 |
| `sportsday-hub/lib/mutations/checklist.ts` | `useToggleCheck`(재사용, 변경 없음) | 변경 없음 |

## Pre-execution

- 작업 브랜치: `feat/마일스톤-완료-optimistic-ui` (main 기반, 이미 생성됨 — spec 커밋 포함).
- 의존: Phase 1(DB 트리거)은 이미 main에 머지됨. 본 Phase는 main 기반이라 별도 의존 없음.

---

### Task 1: ChecklistPanel optimistic 도입

**Files:**
- Modify: `sportsday-hub/components/team/checklist-panel.tsx` (전체 재작성에 가까움)

**Interfaces:**
- Consumes: `useToggleCheck()` from `@/lib/mutations/checklist` (mutationFn이 `item.completed`를 flip → `update({completed: !item.completed})`). `shouldCompleteMilestone(milestone, checklist)` from `@/lib/milestone-completion` (자식 전부 완료면 true). `Checkbox` from `@/components/ui/checkbox` (props: `checked`, `onCheckedChange`, `disabled`).
- Produces: 변경된 `ChecklistPanel` (props 시그니처 동일 — `items`, `milestones`, `teamId` — 소비자측 변경 없음).

**참고 (자동 테스트 한계):** RTL 인프라가 없어 컴포넌트 동작(카운트 즉시 반영·롤백)은 이 태스크 끝의 **수동 검증**(Step 5)으로 확인. 자동 게이트는 `tsc`와 기존 `vitest` 회귀만.

- [ ] **Step 1: `checklist-panel.tsx` 전체 교체**

`sportsday-hub/components/team/checklist-panel.tsx`의 내용을 아래로 완전히 교체:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { AddItemButton } from '@/components/editor/add-item-button'
import {
  useAddChecklistItem,
  useDeleteChecklistItem,
  useToggleCheck,
} from '@/lib/mutations/checklist'
import { shouldCompleteMilestone } from '@/lib/milestone-completion'
import type { ChecklistItem, Milestone, TeamId } from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

export function ChecklistPanel({
  items,
  milestones,
  teamId,
}: {
  items: ChecklistItem[]
  milestones: Milestone[]
  teamId: TeamId | null
}) {
  const addItem = useAddChecklistItem()
  const deleteItem = useDeleteChecklistItem()
  const toggle = useToggleCheck()

  // 낙관적 오버라이드: 체크 토글을 즉시 화면에 반영하기 위한 itemId → completed 맵.
  // DB가 진실 원천(Phase 1 트리거); 이 맵은 화면 미리보기일 뿐이고 DB는 건드리지 않음.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  // 진행 중인 토글 item (해당 체크박스만 비활성화 → 연속 체크 허용)
  const [pendingId, setPendingId] = useState<string | null>(null)

  // SSR이 낙관적 값을 따라잡으면(refresh 도착) 해당 override 제거 → 낡은 미리보기 폐기.
  useEffect(() => {
    setOverrides((prev) => {
      let changed = false
      const next: Record<string, boolean> = {}
      for (const [id, val] of Object.entries(prev)) {
        const ssrItem = items.find((i) => i.id === id)
        if (ssrItem && ssrItem.completed === val) {
          changed = true // SSR이 따라잡음 → 제거
        } else {
          next[id] = val
        }
      }
      return changed ? next : prev
    })
  }, [items])

  // effectiveItems = SSR items를 낙관적 override로 덮은 버전
  const effectiveItems = items.map((i) =>
    overrides[i.id] !== undefined ? { ...i, completed: overrides[i.id] } : i
  )

  const handleToggle = (item: ChecklistItem) => {
    const newCompleted = !item.completed
    setOverrides((prev) => ({ ...prev, [item.id]: newCompleted }))
    setPendingId(item.id)
    toggle.mutate(item, {
      onError: () =>
        // 저장 실패 → 화면 미리보기만 롤백 (DB는 처음부터 안 바뀜)
        setOverrides((prev) => {
          const next = { ...prev }
          delete next[item.id]
          return next
        }),
      onSettled: () => setPendingId(null),
    })
  }

  if (items.length === 0) {
    return <EmptyState title="체크리스트 항목이 없습니다" />
  }

  const milestoneMap = new Map(milestones.map((m) => [m.id, m]))

  // milestone_id로 그룹핑 (null = 상시) — effectiveItems 기준
  const groups = new Map<string | null, ChecklistItem[]>()
  for (const item of effectiveItems) {
    const key = item.milestone_id
    const arr = groups.get(key) ?? []
    arr.push(item)
    groups.set(key, arr)
  }

  // 마일스톤은 날짜순, 상시(null)는 맨 앞
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === null) return -1
    if (b === null) return 1
    const ma = milestoneMap.get(a)
    const mb = milestoneMap.get(b)
    if (!ma || !mb) return 0
    return ma.date.localeCompare(mb.date)
  })

  return (
    <div className="space-y-6">
      {sortedKeys.map((key) => {
        const groupItems = (groups.get(key) ?? []).sort(
          (a, b) => a.sort_order - b.sort_order
        )
        const completed = groupItems.filter((i) => i.completed).length
        const milestone = key ? milestoneMap.get(key) : null
        // 완료 표시: 마일스톤 그룹이고 자식 전부 완료면 (기존 순수함수 재사용)
        const isComplete = milestone
          ? shouldCompleteMilestone(milestone, effectiveItems)
          : false
        const label = milestone
          ? `${format(parseISO(milestone.date), 'M/d (E)', { locale: ko })} · ${milestone.title}`
          : '⚙ 상시 / 특정 시점 없음'

        return (
          <div key={key ?? 'unassigned'}>
            <h3
              className={`mb-2 text-sm font-semibold text-muted-foreground ${
                isComplete ? 'line-through' : ''
              }`}
            >
              {isComplete && '✓ '}
              {label} ({completed}/{groupItems.length})
            </h3>
            <div className="space-y-1">
              {groupItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border p-2"
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => handleToggle(item)}
                    disabled={pendingId === item.id}
                  />
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
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={deleteItem.isPending}
                    onClick={() => deleteItem.mutate(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {teamId && (
              <AddItemButton
                onAdd={(content) =>
                  addItem.mutate({
                    teamId,
                    milestoneId: key,
                    content,
                  })
                }
                label="항목 추가"
                placeholder="새 체크리스트 항목..."
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

변경 요점:
- `EditableChecklistCheckbox` import 제거 → 대신 `Checkbox`(shadcn) + 패널이 제어.
- `useToggleCheck`를 패널로 가져옴.
- `overrides` + `pendingId` state 추가.
- `effectiveItems`로 그룹핑/카운트/완료표시 계산.
- `handleToggle`: 즉시 override → mutate → onError 롤백 → onSettled pendingId 해제.
- `useEffect([items])`: SSR 따라잡으면 override 제거.

- [ ] **Step 2: 타입 게이트**

```bash
cd "C:/Users/0616y/Downloads/26-2 스포츠데이기획/sportsday-hub"
npx tsc --noEmit
```
예상: exit 0. (제거한 `EditableChecklistCheckbox` import로 인한 잔여 참조 없음; `Checkbox`/`useToggleCheck`/`shouldCompleteMilestone` 타입 정상.)

- [ ] **Step 3: 기존 단위 테스트 회귀**

```bash
cd "C:/Users/0616y/Downloads/26-2 스포츠데이기획/sportsday-hub"
npm test
```
예상: 44/44 통과. (`milestone-completion.test.ts` 13개 포함 — `shouldCompleteMilestone` 재사용이 규칙을 바꾸지 않았으므로 그대로 green.)

- [ ] **Step 4: lint 회귀 (내 변경이 게이트를 더럽히는지)**

```bash
cd "C:/Users/0616y/Downloads/26-2 스포츠데이기획/sportsday-hub"
npm run lint
```
예상: `checklist-panel.tsx` 관련 신규 위반 0 (기존 15건은 타 파일 — 회고 #7 별도).

- [ ] **Step 5: 수동 검증 (이 태스크의 핵심 게이트 — RTL 인프라 부재)**

로컬 `npm run dev` 후 팀 페이지 체크리스트 탭에서:

1. **카운트 즉시 반영**: 항목 체크 → 헤더 `(2/4)`가 **refresh 전에** `(3/4)`로 즉시 변하는지. (이전엔 체크박스만 뒤집히고 카운트는 SSR값 고정.)
2. **완료 표시 즉시**: 마지막 항목 체크 → `(4/4)` + 라벨 **취소선 + ✓** 즉시 표시.
3. **해제 즉시 롤백**: 완료 상태에서 하나 해제 → 카운트·✓ 즉시 원복.
4. **에러 시 미리보기 롤백**: DevTools로 네트워크 차단 후 토글 → 에러 토스트 + 카운트·체크박스가 **SSR 원래값으로** 원복 (DB는 안 바뀜).
5. **refresh 후 무깜빡**: 토글 후 ~1초 → 서버가 확정해도 UI가 깜빡이지 않고 유지.

- [ ] **Step 6: 커밋**

```bash
cd "C:/Users/0616y/Downloads/26-2 스포츠데이기획"
git add sportsday-hub/components/team/checklist-panel.tsx
git commit -m "feat: ChecklistPanel optimistic — 체크 토글 시 카운트·완료표시 즉시 반영 (Phase 2)"
```

---

## Self-Review (작성자 점검)

**1. Spec coverage** — spec 각 절:
- §3 아키텍처(optimistic override) → Task 1 Step 1의 `overrides`/`effectiveItems`/`handleToggle` ✅
- §4 컴포넌트 변경(패널 제어 체크박스, EditableChecklistCheckbox 미동) → Task 1 (EditableChecklistCheckbox import 제거, 타임라인 미건드림) ✅
- §5 엣지케이스(롤백·다중탭·연속토글) → onError 롤백, pendingId로 연속 체크 허용, override는 이 탭 로컬 ✅
- §6 테스트(수동 검증) → Task 1 Step 5 (5개 시나리오) ✅
- §7 이원화 노트 → `shouldCompleteMilestone` 재사용으로 신규 규칙 코드 없음 ✅
- §2 비목표(추가/삭제 optimistic 제외) → `useAddChecklistItem`/`useDeleteChecklistItem`은 기존 flow 유지(변경 없음) ✅

**2. Placeholder scan** — TBD/TODO/"적절히 처리" 없음. 모든 코드/명령 완전 기술. ✅

**3. Type/signature 일치** — `overrides: Record<string, boolean>`, `pendingId: string | null`, `handleToggle(item: ChecklistItem)`, `shouldCompleteMilestone(milestone, effectiveItems)` — 일관. `useToggleCheck`의 `mutate(item, {onError, onSettled})` 옵션은 TanStack Query 표준(per-call 콜백은 mutation 정의된 것과 병합 실행). ✅

**4. 누락** — `onSettled` per-call 옵션이 `useToggleCheck` 내부 `onError`(토스트)와 충돌하지 않음(병합 실행). 수동 검증 시나리오 5개가 spec §6를 커버. ✅
