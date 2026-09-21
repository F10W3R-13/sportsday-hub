# 설계: 마일스톤 완료 optimistic UI (Phase 2)

**날짜**: 2026-08-14
**상위 회고**: `docs/lessons/2026-08-12-대시보드-살리기-회고.md` (액션: "마일스톤 자동완료에 optimistic UI 추가")
**범위**: Phase 2 — 체크 토글 시 체크리스트 패널의 진행 카운트·완료 표시를 즉시 반영.
**선행(완료)**: Phase 1(`docs/superpowers/specs/2026-08-12-마일스톤-완료-DB트리거-design.md`) — DB 트리거가 서버 진실 원천. 본 Phase는 **화면 반응 속도 개선만** (DB 데이터 건드리지 않음).

---

## 1. 배경 / 문제

Phase 1 이후 마일스톤 자동완료는 DB 트리거가 담당하지만, 체크 토글 후 **클라이언트에 반영되기까지 `router.refresh()`의 지연(~1초)** 이 있다. `EditableChecklistCheckbox`는 체크박스 자체를 `useState`로 즉시 뒤집지만, **`ChecklistPanel`의 그룹 진행 카운트 `(2/4)`와 완료 표시는 SSR prop 기반이라 refresh 전까지 안 바뀐다.** 이게 회고가 지적한 "체크했는데 마일스톤이 바로 안 닫힌다" 체감의 핵심.

추가로 현재 미세한 불일치도 존재: 체크박스는 즉시 뒤집히지만 카운트는 SSR值 → 토글 직후 "체크됨 표시 + 옛 카운트"가 공존.

## 2. 목표 / 비목표

**목표**
- 체크 토글 시 `ChecklistPanel`의 **그룹 카운트**(x/N)와 **완료 표시**(N/N → ✓/취소선)를 **즉시** 반영.
- 저장 실패 시 **화면의 미리보기만** 롤백 (DB는 건드리지 않음 — 회고 "낙관적 UI는 롤백과 세트").

**비목표 (Phase 2에서 안 함)**
- 다른 뷰(`MilestonePanel`, 타임라인 `EditableMilestoneCheckbox`, 대시보드 위젯)의 즉시 반영 — 이들은 `router.refresh()`에 갱신. (Phase 1 접근법 A의 범위 합의)
- 항목 **추가/삭제**의 optimistic — 토글이 회고의 핵심이므로 제외(YAGNI).
- DB 데이터 변경 — 없음. 본 Phase는 순수 UI.
- RTL+jsdom 테스트 인프라 도입 — 별도 작업.

## 3. 아키텍처

**optimistic checklist 상태를 `ChecklistPanel`로 끌어올리기.** 패널이 낙관적 오버라이드 맵을 추적하고, 거기서 카운트·완료 표시·체크박스 표시를 모두 파생.

```
[체크박스 클릭]
  └─ ChecklistPanel: optimisticOverrides[item.id] = !item.completed  (즉시)
       └─ effectiveItems = items를 override로 덮은 버전
            ├─ 카운트(x/N) · 완료표시 = effectiveItems로 계산 → 즉시 (4/4 + ✓)
            └─ 체크박스 checked = effectiveItems의 completed → 즉시
  └─ toggle.mutate(item)  (DB → Phase1 트리거 → router.refresh)
       ├─ onError: optimisticOverrides[item.id] 제거 → 카운트·배지·체크박스 원복
       └─ router.refresh 도착 → props 갱신 → useEffect가 override 정리(SSR 따라잡으면 폐기)
```

- **DB는 그대로 진실 원천**. optimistic은 어디까지나 화면 미리보기. (사용자 우려 사항 명시: 기존 진행상황·사이트 초기화 일절 없음.)
- 완료 판정은 기존 순수함수 `shouldCompleteMilestone(milestone, effectiveItems)` 재사용.

## 4. 컴포넌트 변경

**`ChecklistPanel` (`components/team/checklist-panel.tsx`)**
- 신규 state: `optimisticOverrides: Record<string, boolean>` (itemId → 낙관적 completed).
- `useToggleCheck()` 훅을 패널로 가져옴 (현재는 `EditableChecklistCheckbox` 내부에 있음).
- `effectiveItems = items.map(i => overrides[i.id] != null ? {...i, completed: overrides[i.id]} : i)`.
- 그룹 카운트·라벨을 `effectiveItems`로 계산. `completed === length`면 라벨에 완료 표시(취소선 + ✓).
- 각 항목의 체크박스를 **패널이 제어**: `<Checkbox checked={eff.completed} onCheckedChange={handler}/>` (shadcn `Checkbox` 직접 사용).
  - `handler`: `setOverrides(id → !eff.completed)` 즉시 → `toggle.mutate(item, { onError: () => removeOverride(id) })`.
- `useEffect([items])`: SSR prop 값과 override가 같아지면 override 제거 (refresh가 따라잡은 시점에 낙관적 상태 폐기).

**`EditableChecklistCheckbox` (`components/editor/editable-checkbox.tsx`) — 변경 없음**
- 타임라인(`timeline-list.tsx`)에서 계속 사용. Phase 2는 여기 손 안 댐.
- 근거: 이 컴포넌트는 2곳(checklist-panel + timeline)에 쓰이는데, controlled로 전환하면 timeline까지 영향. ChecklistPanel이 자체 제어 체크박스를 렌더하는 편이 blast radius가 작음.

## 5. 엣지케이스

| 상황 | 동작 |
|------|------|
| 마지막 항목 체크 | 카운트 N/N + 완료표시 즉시; DB 트리거가 마일스톤 completed 갱신 → refresh가 확정 |
| 체크 해제 | 카운트·완료표시 즉시 롤백 |
| 저장 실패(오프라인 등) | `onError`가 override 제거 → 카운트·체크박스 원복 (DB는 처음부터 안 바뀜) |
| 순수 마일스톤(자식 0) | ChecklistPanel에 그룹 없음 → 해당 없음 |
| 다중 탭 | optimistic은 이 탭 로컬. 다른 탭은 기존 `notifyTabs`+refresh로 갱신(변경 없음) |
| 연속 토글 | 마지막 override가 승; react-query가 mutation 큐 처리 |
| SSR이 아직 안 따라잡은 동안 refresh | useEffect가 prop==override일 때만 제거 → 깜빡임 없음 |

## 6. 테스트 (Phase 1과 동일한 제약 — RTL 인프라 부재)

- **판정 규칙** → `milestone-completion.test.ts`(순수함수 13개)가 이미 커버. ✅
- **optimistic UI 동작**(카운트 즉시 반영, 롤백) → 컴포넌트 동작이라 RTL+jsdom 필요하나 인프라 없음 → **수동 검증**으로 처리.
- 수동 검증 시나리오:
  1. 마지막 항목 체크 → 카운트 N/N + 완료 표시 **즉시** (refresh 전)
  2. 체크 해제 → 카운트·표시 즉시 롤백
  3. 오프라인 토글(DevTools 네트워크 차단) → 에러 시 카운트·체크박스 원복
  4. 토글 후 ~1초 → refresh가 확정해도 깜빡임 없이 유지

## 7. 유지보수 노트

- **규칙 이원화(Phase 1과 동일)**: 완료 판정 규칙이 (a) DB 트리거 `recompute_milestone`(SQL)·(b) `shouldCompleteMilestone`(TS, 본 Phase)에 존재. 규칙 변경 시 셋 모두 갱신. 본 Phase는 기존 `shouldCompleteMilestone`을 **재사용**하므로 새 규칙 코드는 추가하지 않음 — 이원화 부담 증가 없음.
- optimistic은 "미리보기"일 뿐, 진실은 DB. override 정리 로직(useEffect)이 잘못되면 낡은 미리보기가 남을 수 있음 → 수동 검증 시나리오 4로 확인.

## 8. 위험 / 완화

| 위험 | 완화 |
|------|------|
| override 정리(useEffect) 미흡 → 낡은 optimistic 잔류 | 수동 검증 4; prop==override일 때만 제거하는 단순 로직 |
| 체크박스 토글 로직 중복(패널 vs `EditableChecklistCheckbox`) | 타임라인은 미동; 패널만 자체 제어. 공통 추출은 필요 시 별도 리팩터 |
| 토글 실패 시 체크박스는 원복했으나 카운트 override가 남음 | 동일 `onError`에서 override 제거 → 한 곳에서 처리 |

## 9. 참고 파일

- 선행: `docs/superpowers/specs/2026-08-12-마일스톤-완료-DB트리거-design.md` (Phase 1)
- 회고: `docs/lessons/2026-08-12-대시보드-살리기-회고.md` (§4.2 optimistic UI)
- 변경 대상: `sportsday-hub/components/team/checklist-panel.tsx`
- 재사용: `sportsday-hub/lib/milestone-completion.ts`(`shouldCompleteMilestone`), `sportsday-hub/lib/mutations/checklist.ts`(`useToggleCheck`)
- 미동: `sportsday-hub/components/editor/editable-checkbox.tsx`, `sportsday-hub/components/timeline/timeline-list.tsx`
