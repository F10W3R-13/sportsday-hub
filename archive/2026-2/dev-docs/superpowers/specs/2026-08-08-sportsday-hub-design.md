# 26-2 스포츠데이 기획 허브 — 설계 문서

**작성일**: 2026-08-08
**대상**: 26-2 스포츠데이(HI-Side Out) 기획팀 협업 웹앱
**상태**: 승인됨 (설계 단계 완료)

---

## 0. 배경

26-2 스포츠데이 기획은 5개 팀(기획관리/컨텐츠/예산/교환담당/타임라인·인원관리)이 마크다운 지침서로 진행상황을 관리 중이다. 마스터 지침에 핵심 결정 추적표·마일스톤·의존관계·팀별 산출물이 정리되어 있으나, 팀원 누구나 언제 어디서나 시각적으로 진행상황을 공유하기 어렵다.

본 웹앱은 각 팀이 하나의 허브처럼 쓸 수 있는 거대한 협업 웹앱으로, 진행상황을 편하게 공유하고 시각적으로 볼 수 있게 한다.

---

## 1. 요구사항 요약

브레인스토밍을 통해 확정된 핵심 요구사항:

| 항목 | 결정 |
|---|---|
| 핵심 역할 | 읽기+쓰기 협업 허브 |
| 편집 권한 | 열린 편집 (인증 없음, 누구나 편집) |
| 데이터 동기화 | 공유 클라우드 DB (Supabase) |
| 초기 데이터 | 마크다운 지침에서 이주 |
| 화면 | 전체 현황 대시보드 + 팀별 워크스페이스 + 타임라인/간트 차트 + 체크리스트 통합 뷰 |
| 배포 | Vercel + Supabase (모두 무료 티어) |
| 동기화 정도 | 비용 우선 → 새로고침 갱신 (Realtime 없음, 향후 무료 추가 가능) |

---

## 2. 접근 방식 — 하이브리드 데이터 모델 (선택됨)

3가지 접근(평면/정규화/하이브리드)을 비교해 **하이브리드**를 선택했다.

- **정규화 테이블**: 집계·필터·상태 변경이 필요한 핵심 항목(teams, decisions, milestones, checklist_items, issues)
- **JSONB 문서**: 풍부한 콘텐츠(팀 지침 섹션)는 마크다운 문자열로 저장해 구조 손실 없이 유연하게

마크다운 지침의 복잡한 계층(섹션→하위→체크리스트→이슈 로그)을 정규화로 전부 표현하면 테이블이 폭발하고, 반대로 전부 JSON으로 묶으면 대시보드 집계가 어렵다. 하이브리드는 "구조는 JSON으로 유연하게, 추적이 필요한 핵심 항목만 테이블로" 나눠 양쪽을 잡는다.

---

## 3. 아키텍처 & 기술 스택

```
┌─────────────────────────────────────────────────────────┐
│                    브라우저 (팀원)                         │
│  Next.js App Router + React Server Components            │
│  shadcn/ui + Tailwind CSS                                │
│  TanStack Query (데이터 캐싱/재검증)                       │
└───────────────┬─────────────────────────┬───────────────┘
                │ Server Components 조회   │ Client 편짐
                ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js (Vercel 호스팅)                      │
│  Route Handlers / Server Actions                         │
│  마크다운 이주 스크립트 (일회성, 빌드 시 실행)              │
└───────────────────────┬─────────────────────────────────┘
                        │ Postgres wire protocol
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 Supabase (무료 티어)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Postgres DB │  │ Storage(선택)│  │ Auto API/RLS   │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 기술 선택과 이유

| 기술 | 역할 | 왜 이것인가 |
|---|---|---|
| **Next.js 15 (App Router)** | 풀스택 프레임워크 | Vercel과 1티어 통합, Server Components로 초기 로딩 빠름. shadcn/ui 공식 권장 |
| **shadcn/ui + Tailwind v4** | UI 컴포넌트 | 요청사항. Radix 기반 접근성, 복사-붙여넣기 방식이라 커스터마이징 자유 |
| **Supabase (Postgres)** | DB + API | 무료 티어 500MB/50,000 row면 본 프로젝트 넉넉. JSONB 지원 → 하이브리드 모델 구현 핵심. RLS로 행 수준 보안 |
| **TanStack Query v5** | 클라이언트 데이터 캐싱 | 편집 후 낙관적 업데이트 + 자동 재검증. 새로고침 갱신 방식을 단순하게 구현 |
| **Zod** | 런타임 검증 | JSONB 문서 구조 타입 안전성 보장. 폼 검증에도 재사용 |

### 비용 구조 (모두 무료 티어)

- Vercel Hobby: 무제한 정적, Serverless 함수 월 100GB-시간
- Supabase Free: 500MB DB, 50,000 row, 2GB 대역폭, 무한 프로젝트
- 도메인: `*.vercel.app` 서브도메인 (무료) 또는 개인 도메인 연결 가능

---

## 4. 데이터 모델

### ERD 개요

```
┌──────────────────┐       ┌──────────────────────┐
│     teams        │ 1───∞ │  checklist_items     │  정규화
│ (정규화+JSONB)   │ 1───∞ │  issues              │  정규화
└──────────────────┘       └──────────────────────┘
        │
        │  guideline_doc (JSONB): 섹션별 마크다운
        │  - 게임 구성 상세, 점수 체계, 과거 실적,
        │    배치도, 피드백 상세 등 집계 불필요 콘텐츠
        ▼
┌──────────────────┐       ┌──────────────────────┐
│   decisions      │       │     milestones       │  정규화
│ (D1~D7 결정추적) │       │ (날짜 산출물/회의)    │
│ team_id = NULL   │       │ team_id (nullable)   │
│ (전체 단위)       │       │ (전체 또는 팀 소속)    │
└──────────────────┘       └──────────────────────┘
```

### 정규화된 테이블 — 대시보드 집계·필터 대상

#### `teams` — 5개 팀의 기본 정보 + 풍부한 지침
```sql
teams
├─ id            text PK     -- 'management'|'content'|'budget'|'exchange'|'timeline'
├─ name          text        -- '기획관리팀'
├─ name_en       text        -- 'Management'
├─ color         text        -- 테마 컬러 hex
├─ icon          text        -- lucide 아이콘명
├─ sort_order    int         -- 표시 순서
├─ mission       text        -- 미션 한 줄 요약 (카드에 표시)
├─ guideline_doc jsonb       -- 풍부한 지침 (아래 구조)
├─ created_at    timestamptz
└─ updated_at    timestamptz
```

#### `decisions` — 핵심 결정 추적표 (마스터 지침 §3)
```sql
decisions
├─ id             text PK    -- 'D1'~'D7'
├─ title          text       -- '컨셉/행사명'
├─ options        text[]     -- ['인사이드아웃','미니언즈',...]
├─ status         text       -- 'confirmed'|'discussing'|'pending'|'deferred'
├─ current_value  text       -- '인사이드아웃 / HI-Side Out'
├─ decision_date  date       -- nullable
├─ sort_order     int
├─ notes          text
└─ updated_at     timestamptz
```

#### `milestones` — 마일스톤 & 산출물 일정 (마스터 §4-2)
```sql
milestones
├─ id            uuid PK
├─ date          date       -- 8/9, 9/19 등
├─ title         text       -- '타임라인 완성'
├─ team_id       text FK→teams.id  -- nullable (전체 일정은 NULL)
├─ category      text       -- 'meeting'|'deliverable'|'event'
├─ completed     bool
├─ depends_on    uuid[]     -- 의존하는 다른 milestone id (간트 화살표)
├─ sort_order    int
└─ updated_at    timestamptz
```

#### `checklist_items` — 모든 체크리스트 (각 팀 §진행체크리스트 + 피드백 체크리스트)
```sql
checklist_items
├─ id            uuid PK
├─ team_id       text FK→teams.id  -- nullable (전체 건)
├─ section       text       -- 'progress'|'feedback'|'prep'
├─ content       text       -- '구글폼 성별 항목 기본 포함'
├─ priority      text       -- 'high'|'medium'|'low'|nullable
├─ completed     bool
├─ source        text       -- '26-1 feedback' 등 출처
├─ sort_order    int
└─ updated_at    timestamptz
```

#### `issues` — 이슈 로그 (마스터 §8 + 각 팀 §이슈로그)
```sql
issues
├─ id            uuid PK
├─ team_id       text FK→teams.id  -- nullable
├─ date          date
├─ title         text
├─ status        text       -- 'open'|'in_progress'|'resolved'
├─ notes         text
└─ updated_at    timestamptz
```

### JSONB — `teams.guideline_doc` 구조

체크리스트/이슈/마일스톤/결정은 정규화 테이블로 빼낸 뒤, 나머지 풍부한 콘텐츠를 섹션별 마크다운으로 저장한다.

```jsonc
{
  "sections": [
    {
      "id": "mission",
      "title": "팀 미션 & 산출물",
      "order": 1,
      "content_md": "## 미션\n- 토너먼트 게임 4종..."
    },
    {
      "id": "game-config",
      "title": "게임 구성",
      "order": 2,
      "content_md": "### 필수 구성\n| 구분 | 개수 |..."
    }
    // ... 배치도, 과거 실적, 피드백 상세 등
  ]
}
```

**왜 마크다운 문자열인가:** 팀 지침엔 표·계층 헤딩·코드블록이 뒤섞여 있어 이걸 노드 트리로 정규화하면 테이블이 폭발한다. 마크다운 문자열 + 웹 렌더링(react-markdown)이 가장 손실 없고, 편집도 마크다운 에디터 하나로 단순하다.

### 마크다운 이주 매핑

마이그레이션 스크립트가 각 지침 파일을 이렇게 분해한다:

| 마크다운 섹션 | → 이동 |
|---|---|
| 마스터 §3 핵심 결정 추적표 | `decisions` 테이블 (7행) |
| 마스터 §4-1 회의 일정 | `milestones` (category='meeting') |
| 마스터 §4-2 산출물 일정 | `milestones` (category='deliverable', team_id 매핑) |
| 마스터 §8 이슈 로그 | `issues` (team_id=NULL) |
| 각 팀 "- [ ] 체크리스트" | `checklist_items` (해당 team_id) |
| 각 팀 "이슈 로그" | `issues` (해당 team_id) |
| **나머지 모든 섹션** | `teams.guideline_doc.sections[]` |

### RLS 정책 (열린 편집)

사용자가 인증 없는 열린 편집을 선택했으므로, 모든 테이블에 `anon` 역할의 전권을 부여한다:

```sql
-- 모든 테이블에 동일 패턴
CREATE POLICY "open_read"  ON teams  FOR SELECT USING (true);
CREATE POLICY "open_write" ON teams  FOR INSERT WITH CHECK (true);
CREATE POLICY "open_edit"  ON teams  FOR UPDATE USING (true);
CREATE POLICY "open_del"   ON teams  FOR DELETE USING (true);
```

> ⚠️ 보안 메모: 이는 누구나 데이터를 지울 수 있음을 의미한다. 데이터 복구 안전망은 §6(편집 흐름/오류 처리)의 audit_log + soft-delete로 제공한다.

---

## 5. 화면 구성 & 정보 아키텍처

### 전체 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│  [☰ 사이드바]  │         HI-Side Out Hub                     │
│                │  ┌──────────────────────────────────────┐  │
│  📊 대시보드    │  │                                      │  │
│  ──────────    │  │           (페이지 콘텐츠)              │  │
│  팀 워크스페이스 │  │                                      │  │
│  ▸ 기획관리      │  │                                      │  │
│  ▸ 컨텐츠        │  │                                      │  │
│  ▸ 예산          │  │                                      │  │
│  ▸ 교환          │  │                                      │  │
│  ▸ 타임라인      │  │                                      │  │
│  ──────────    │  │                                      │  │
│  📅 타임라인     │  │                                      │  │
│  ☑ 체크리스트   │  │                                      │  │
└────────┬───────┴──┴──────────────────────────────────────┘
         │ 모바일: 햄버거 버튼으로 사이드바 토글
```

- **사이드바**: 데스크톱 고정 / 모바일 시트(Drawer)
- **반응형**: Tailwind 브레이크포인트 — 모바일 1단, 태블릿 2단, 데스크톱 다단
- shadcn/ui `Sidebar` 컴포넌트 사용

### 화면 1 — 전체 현황 대시보드 (`/`)

"지금 우리 어디쯤 있나"를 한눈에.

```
┌────────────────────────────────────────────────────────────┐
│  HI-Side Out · 2026. 9. 19(토) · D-42                       │
├──────────────┬──────────────┬──────────────┬───────────────┤
│  확정 결정    │  논의중       │  보류/미정    │  전체 진행률   │
│     4        │     3        │     ?        │     62%       │
└──────────────┴──────────────┴──────────────┴───────────────┘

▼ 핵심 결정 추적표 (D1~D7)
┌────────────────────────────────────────────────────────────┐
│ D1  컨셉/행사명     🟢 확정  인사이드아웃 / HI-Side Out  [편집]│
│ D2  팀 개수         🟢 확정  6팀                        [편집]│
│ D4  입장료          ⚪ 보류  (8/16~8/25 결정)             [편집]│
│ ...                                                         │
└────────────────────────────────────────────────────────────┘

▼ 팀별 현황 카드 (5개)
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ...
│ 컨텐츠팀      │ │ 예산팀       │ │ 교환담당팀   │
│ 진행률 45%   │ │ 진행률 30%  │ │ 진행률 60%  │
│ 체크 4/11    │ │ 체크 3/10   │ │ 체크 5/8    │
│ 이슈 0      │ │ 이슈 1      │ │ 이슈 0      │
│ [자세히 →]   │ │ [자세히 →]  │ │ [자세히 →]  │
└─────────────┘ └─────────────┘ └─────────────┘

▼ 다가오는 마일스톤 (다음 3개)
• 8/9  기획팀 2차 회의 — 중간 방향 점검
• 8/13 타임라인 완성
• 8/16 컨텐츠 완성
```

**상태 배지(3단 분류) 회의 일관성 유지:** 🟢 확정 / 🟡 논의중 / ⚪ 보류·미정 — 기존 회의 수정안 spec의 SSOT를 그대로 계승한다.

### 화면 2 — 팀별 워크스페이스 (`/team/[id]`)

탭으로 역할 분담.

```
┌────────────────────────────────────────────────────────────┐
│  ◀ 컨텐츠팀                                       진행률 45% │
├────────────────────────────────────────────────────────────┤
│  [개요] [지침] [체크리스트] [마일스톤] [이슈]                  │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ▼ 탭: 지침 (guideline_doc 마크다운 렌더링)                   │
│  ┌──────────────────────────────────────────────────┐       │
│  │ ## 미션                                               │ │       │
│  │ - 토너먼트 게임 4종...                              [편집]│       │
│  │ ## 게임 구성                                          │ │       │
│  │ | 구분 | 개수 | ...                                [편집]│       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  ▼ 탭: 체크리스트                                            │
│  ☐ 🔴 심판 규칙 사전 숙지 (최소 3일 전 역할 배정)             │
│  ☐ 🟡 토너먼트 1·2부 균형 배분                              │
│  ☑ 🟢 페이스페인팅 유지                                    │
│                                                              │
│  ▼ 탭: 마일스톤 (해당 팀 산출물만)                            │
│  8/9  컨텐츠 방향성 뼈대          ☐                          │
│  8/16 컨텐츠 완성                 ☐                          │
│  8/30 컨텐츠 안내 홍보부 인계     ☐                          │
└────────────────────────────────────────────────────────────┘
```

**탭별 데이터 소스:**
- 개요: `teams` 기본 정보(mission)
- 지침: `teams.guideline_doc.sections[]` → react-markdown 렌더링 + 인라인 편집
- 체크리스트/마일스톤/이슈: 정규화 테이블에서 `team_id` 필터

### 화면 3 — 타임라인 / 간트 차트 (`/timeline`)

```
┌────────────────────────────────────────────────────────────┐
│  타임라인      [전체 ▾] [회의/산출물/이벤트 필터]              │
├────────────────────────────────────────────────────────────┤
│           8/9  8/13 8/16 8/20 8/28 8/31 9/3 9/4 9/19        │
│  회의      ●───●────────────────────────────────●  (선)     │
│  컨텐츠        ├───●──────●──────────────────             │
│  예산             ├──────(입장료 8/16~8/25)───●──●         │
│  교환                    ├──────────●────●        ●        │
│  타임라인   ├──●─────────────────────────────               │
│  기획관리                                    ●──●──●──●     │
│                                                              │
│  ● = 마일스톤, 선 = 기간, ─→ = 의존관계 화살표                │
│  행 클릭 시 상세 / 편집 패널                                  │
└────────────────────────────────────────────────────────────┘
```

- **기본 구현**: 단순 타임라인 리스트(날짜순 마일스톤 나열)로 먼저 출시 — 구현 단순, 3단계 첫 배포에 포함
- **강화 버전(선택)**: framer-motion 기반 간트 차트(팀별 행 + 날짜 열)로 6단계(UX 다듬기)에서 교체 가능. 복잡도가 예상보다 크면 리스트를 유지
- 마일스톤 1개 = 점, 기간 산출물 = 막대
- 의존관계(`depends_on`)는 점선 화살표로 표시

### 화면 4 — 체크리스트 통합 뷰 (`/checklists`)

```
┌────────────────────────────────────────────────────────────┐
│  체크리스트   [전체 ▾] [전체/미완료/완료] [우선순위 ▾]        │
├────────────────────────────────────────────────────────────┤
│  전체 진행률 ████████░░░░░░░░ 45%  (28/62)                   │
├────────────────────────────────────────────────────────────┤
│  ▼ 컨텐츠팀 (4/11)                          [모두 펼치기]    │
│  ☐ 🔴 심판 규칙 사전 숙지 — 최소 3일 전                       │
│  ☐ 🟡 토너먼트 균형 배분                                     │
│  ☑ 🟢 페이스페인팅 유지                                      │
│  ...                                                         │
│  ▼ 예산팀 (3/10)                                             │
│  ...                                                         │
└────────────────────────────────────────────────────────────┘
```

- 팀별 아코디언 그룹핑
- 인라인 체크 토글 → 즉시 DB 반영 (낙관적 업데이트)
- 필터: 팀 / 완료 여부 / 우선순위

### 편집 UX 패턴 (모든 화면 공통)

- **인라인 편집**: 클릭 시 필드가 input/textarea로 전환 (shadcn `Input`/`Textarea`)
- **마크다운 편집**: 섹션 [편집] 버튼 → 모달에서 `Textarea` 편집 + 실시간 미리보기 분할
- **체크박스**: 단일 클릭 즉시 토글 (가장 빈번한 액션)
- **결정 상태 변경**: shadcn `Select` 드롭다운
- **새 항목 추가**: 각 섹션 하단 `[+ 추가]` 버튼

---

## 6. 편집 흐름 & 오류 처리

### 편집 흐름 — 새로고침 갱신 방식

비용 우선을 선택했으므로 Supabase Realtime 없이 구현한다.

```
사용자 편집                  클라이언트                  서버/DB
    │                           │                          │
    │  1. 체크/입력              │                          │
    ├──────────────────────────▶│                          │
    │                           │  2. 낙관적 업데이트        │
    │                           │  (UI 즉시 반영)            │
    │                           ├──────────────────────────▶│
    │                           │                          │ 3. DB UPDATE
    │                           │◀──────────────────────────┤
    │                           │  4. 확정 결과 반영          │
    │                           │  (성공: 유지 / 실패: 롤백)  │
    │  5. 다른 사용자가           │                          │
    │     새로고침/재진입 시에만    │                          │
    │     변경사항 확인            │                          │
```

**핵심: TanStack Query `useMutation` + `onMutate` 낙관적 업데이트**

```typescript
// 체크리스트 토글 예시 (의사코드)
const toggleCheck = useMutation({
  mutationFn: (item) => supabase.from('checklist_items')
    .update({ completed: item.completed }).eq('id', item.id),
  onMutate: async (item) => {
    await queryClient.cancelQueries(['checklist'])
    const prev = queryClient.getQueryData(['checklist'])
    queryClient.setQueryData(['checklist'], (old) => /* 토글 */)
    return { prev }   // 실패 시 롤백 컨텍스트
  },
  onError: (_err, _item, ctx) => {
    queryClient.setQueryData(['checklist'], ctx.prev)
    toast.error('저장 실패. 다시 시도해주세요.')
  },
  onSettled: () => queryClient.invalidateQueries(['checklist']),
})
```

**재검증 트리거 (다른 사용자 변경 감지):**
- 페이지 진입/재포커스 시 자동 재검증 (`refetchOnWindowFocus: true` 기본값)
- 수동 새로고침 버튼 (헤더에 🔄)
- 간트/체크리스트 화면 진입 시 항상 최신 fetch
- 이 방식으로 Realtime 없이도 "거의 실시간" 체감 (무료)

### 변경 이력 (audit_log) — 열린 편집의 안전망

누구나 편집 가능하므로, 누가 언제 뭘 바꿨는지를 전부 기록한다. 사용자 식별은 인증 대신 닉네임 입력으로 처리한다.

```sql
audit_log
├─ id            uuid PK
├─ table_name    text       -- 'checklist_items'|'decisions'|...
├─ record_id     text       -- 변경된 row의 id
├─ action        text       -- 'insert'|'update'|'delete'
├─ changed_by    text       -- 사용자 닉네임 (세션)
├─ old_value     jsonb      -- 변경 전 스냅샷
├─ new_value     jsonb      -- 변경 후 스냅샷
├─ created_at    timestamptz default now()
```

**기록 방식:** Postgres 트리거 함수가 모든 테이블의 INSERT/UPDATE/DELETE를 자동 캡처한다.

> **soft-delete와의 관계:** 일반적인 항목 삭제는 soft-delete(`deleted_at` UPDATE)로 처리되므로 audit에는 UPDATE로 기록된다. 실제 DELETE 이벤트는 30일 경과 후 cron이 영구 삭제할 때만 발생하며, 이때도 audit가 캡처한다.

**닉네임 세션 변수 설정 함수** — 클라이언트는 Supabase의 prepared statement 특성상 직접 `SET`을 호출할 수 없으므로, RPC로 노출된 함수를 통해 설정한다:

```sql
-- 클라이언트가 호출: supabase.rpc('set_user_context', { p_nickname: '지훈' })
CREATE FUNCTION set_user_context(p_nickname text)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.changed_by', COALESCE(p_nickname, '익명'), true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**audit 트리거 함수:**

```sql
CREATE FUNCTION audit_trigger() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log(table_name, record_id, action,
    old_value, new_value, changed_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    COALESCE(current_setting('app.changed_by', true), '익명')
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

**닉네임 식별 (인증 대체):**
- 첫 진입 시 닉네임 입력 모달 (localStorage 저장)
- Supabase 클라이언트가 매 편집 전 `supabase.rpc('set_user_context', { p_nickname })` 호출로 세션 변수 설정
- audit_log의 `changed_by`로 "마지막 수정: ○○ · 3분 전" 표시

### 복구 UX

```
┌────────────────────────────────────────────────────────────┐
│  변경 이력 — "심판 규칙 사전 숙지" 체크리스트                │
├────────────────────────────────────────────────────────────┤
│  8/8 14:32  지훈  ☑ 완료로 변경              [이 버전으로]  │
│  8/8 11:15  수민  ☐ 미완료로 변경 (롤백)     [이 버전으로]  │
│  8/7 22:01  지훈  — 항목 생성                 [이 버전으로]  │
└────────────────────────────────────────────────────────────┘
```

- 항목별 [이력] 버튼 → 변경 스냅샷 목록
- 특정 버전 클릭 시 `old_value`로 복원 (새 UPDATE 발생, 이것도 audit에 기록)

### 삭제 정책 — soft-delete

실수 삭제를 막기 위해 실제 DELETE 대신 플래그 컬럼 사용한다:

```sql
-- 모든 콘텐츠 테이블에 추가
deleted_at timestamptz DEFAULT NULL

-- 조회 시 항상 필터
WHERE deleted_at IS NULL
```

- 휴지통 뷰 (`/trash`)에서 30일 내 복원 가능
- 30일 경과 시 cron 잡이 영구 삭제 (Supabase 무료 스케줄러)

### 오류 처리 매트릭스

| 상황 | 사용자 경험 | 기술 대응 |
|---|---|---|
| 저장 실패 (네트워크) | 토스트 "저장 실패, 재시도" + UI 롤백 | `onError` 롤백 + 재시도 버튼 |
| 동시 편집 충돌 | 후저장자에게 "다른 사람이 먼저 수정함" 안내 | `updated_at` 비교, 최신版 우선 |
| 닉네임 미설정 | 첫 편집 시 모달로 입력 유도 | 세션 변수 누락 시 '익명' fallback |
| DB 한도 도달 | 50,000 row 경고 배너 | Supabase 사용량 모니터링 훅 |
| 빈 상태 | 각 화면 empty state 일러스트 + 안내 | 컴포넌트별 EmptyState |

### 동시 편집 충돌 완화

실시간 동기화가 없으므로 두 사람이 같은 항목을 동시에 고칠 수 있다:

- **체크박스/상태 변경**: 단순 필드라 마지막 저장이 이기는 "last-write-wins" 적용 (대부분 무해)
- **마크다운 섹션 편집**: 저장 시 `updated_at`을 비교해, 내가 연 시점보다 최근 수정이 있으면 경고 모달 — 덮어쓸지 다시 불러올지 선택
- **잦은 충돌 우려**: 회의 중 같은 항목을 여럿이 고칠 때. 완화책으로 각 편집 모달 상단에 "마지막 수정: ○○ · 3분 전" 표시로 겹침 인지 유도

---

## 7. 프로젝트 구조

### 디렉토리 구조

```
sportsday-hub/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # 루트 레이아웃 (사이드바 + 닉네임 provider)
│   ├── page.tsx                      # 대시보드 (/)
│   ├── team/[id]/page.tsx            # 팀 워크스페이스
│   ├── timeline/page.tsx             # 간트 차트
│   ├── checklists/page.tsx           # 체크리스트 통합 뷰
│   ├── trash/page.tsx                # 휴지통
│   └── api/                          # Route Handlers (필요 시)
├── components/
│   ├── ui/                           # shadcn/ui 컴포넌트 (자동 생성)
│   │   ├── button.tsx, card.tsx, dialog.tsx, ...
│   ├── layout/
│   │   ├── sidebar.tsx               # 팀 목록 + 네비게이션
│   │   ├── header.tsx                # 닉네임 표시 + 새로고침
│   │   └── nickname-provider.tsx     # 닉네임 세션 컨텍스트
│   ├── dashboard/
│   │   ├── stats-cards.tsx           # 통계 카드 (확정/논의중/보류/진행률)
│   │   ├── decision-tracker.tsx      # 핵심 결정 추적표
│   │   ├── team-status-card.tsx      # 팀별 현황 카드
│   │   └── upcoming-milestones.tsx   # 다가오는 마일스톤
│   ├── team/
│   │   ├── team-tabs.tsx             # 탭 컨테이너
│   │   ├── guideline-viewer.tsx      # 마크다운 렌더링 + 편집
│   │   ├── checklist-panel.tsx       # 팀 체크리스트
│   │   ├── milestone-panel.tsx       # 팀 마일스톤
│   │   └── issue-panel.tsx           # 팀 이슈 로그
│   ├── timeline/
│   │   └── gantt-chart.tsx           # 간트 차트 (자체 구현)
│   ├── checklist/
│   │   └── unified-checklist.tsx     # 통합 체크리스트
│   ├── editor/
│   │   ├── inline-edit.tsx           # 인라인 편집 래퍼
│   │   ├── markdown-editor.tsx       # 마크다운 편집 모달
│   │   └── decision-select.tsx       # 결정 상태 셀렉트
│   ├── history/
│   │   └── audit-log-dialog.tsx      # 변경 이력 다이얼로그
│   └── shared/
│       ├── status-badge.tsx          # 🟢🟡⚪ 배지
│       ├── priority-badge.tsx        # 🔴🟡🟢 우선순위
│       └── empty-state.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # 브라우저 클라이언트
│   │   ├── server.ts                 # 서버 클라이언트 (RSC)
│   │   └── middleware.ts             # 세션 변수(닉네임) 주입
│   ├── queries/
│   │   ├── decisions.ts              # 결정 CRUD + 쿼리 키
│   │   ├── milestones.ts             # 마일스톤 CRUD
│   │   ├── checklist.ts              # 체크리스트 CRUD
│   │   ├── issues.ts                 # 이슈 CRUD
│   │   ├── teams.ts                  # 팀 + guideline_doc CRUD
│   │   └── audit.ts                  # audit_log 조회
│   ├── markdown/
│   │   ├── parser.ts                 # 마크다운 → JSONB 파서
│   │   └── renderer.tsx              # react-markdown 설정
│   ├── types/
│   │   ├── database.ts               # Supabase 생성 타입
│   │   └── models.ts                 # 도메인 타입 (Zod 스키마)
│   └── utils.ts                      # cn() 등 유틸
├── migrations/                       # Supabase SQL 마이그레이션
│   ├── 0001_init_schema.sql          # 테이블 생성
│   ├── 0002_rls_policies.sql         # RLS 정책 (열린 편집)
│   ├── 0003_audit_trigger.sql        # audit_log 트리거
│   ├── 0004_soft_delete.sql          # deleted_at 컬럼
│   └── 0005_seed_data.sql            # 마크다운 이주 시드
├── scripts/
│   └── migrate-from-md.ts            # 마크다운 → SQL 시드 생성
├── supabase/
│   └── config.toml                   # Supabase 로컬 설정
├── content-source/                   # 이주 원본 마크다운 (참조용 복사)
│   ├── 00_기획지침_마스터.md
│   └── teams/
├── package.json
├── tailwind.config.ts                # Tailwind v4
├── components.json                   # shadcn/ui 설정
├── .env.local.example                # Supabase 키 템플릿
└── next.config.ts
```

### 핵심 의존성 (package.json)

```jsonc
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^latest",
    "@tanstack/react-query": "^5",
    "tailwindcss": "^4",
    "react-markdown": "^9",
    "remark-gfm": "^4",
    "framer-motion": "^11",
    "zod": "^3",
    "lucide-react": "^latest",
    "date-fns": "^4",
    "sonner": "^latest",
    "clsx": "^2",
    "tailwind-merge": "^2"
  },
  "devDependencies": {
    "@supabase/cli": "^latest",
    "supabase": "^latest",
    "typescript": "^5",
    "@types/react": "^19",
    "@types/node": "^22"
  }
}
```

### 데이터 흐름 — Server vs Client Component 분리

```
┌─────────────────────────────────────────────────────────┐
│  Server Component (page.tsx)                             │
│  • Supabase 서버 클라이언트로 초기 데이터 fetch           │
│  • SEO/초기 로딩 최적화 (RSC 페이로드)                    │
│  • 예: const decisions = await getDecisions()            │
└──────────────────┬──────────────────────────────────────┘
                   │ props (직렬화 가능 데이터)
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Client Component ('use client')                         │
│  • TanStack Query로 편집 후 재검증                        │
│  • useMutation 낙관적 업데이트                            │
│  • 인터랙티브 UI (다이얼로그, 셀렉트, 체크)                │
└─────────────────────────────────────────────────────────┘
```

**원칙:** 조회는 RSC에서, 편집은 클라이언트에서. 초기 로딩 빠르고 편집 반응성 확보.

### 마크다운 이주 파이프라인

```
content-source/*.md
        │
        ▼  scripts/migrate-from-md.ts
┌────────────────────────────────────────┐
│  1. 마크다운 파싱 (markdown parser)      │
│     - 헤딩 기준 섹션 분리                │
│     - 표·체크리스트·코드블록 보존         │
│  2. 분류: 정규화 vs JSONB               │
│     - "결정 추적표" 표 → decisions       │
│     - "- [ ]" → checklist_items        │
│     - "마일스톤" 표 → milestones        │
│     - "이슈 로그" 표 → issues           │
│     - 나머지 → guideline_doc.sections   │
│  3. SQL 시드 파일 생성                   │
└──────────────────┬─────────────────────┘
                   ▼
        migrations/0005_seed_data.sql
                   │
                   ▼  supabase db push
              Supabase DB
```

**이주 스크립트 특징:**
- 일회성이지만 재실행 가능 (idempotent — `ON CONFLICT DO NOTHING`)
- 5개 마크다운 파일(마스터 + 팀 4)을 모두 처리
- 콘솔에 이주 결과 요약 출력 (X decisions, Y milestones, Z checklist items 등)
- 향후 마크다운 원본 수정 시 재실행으로 동기화 가능

### Supabase 클라이언트 패턴

```typescript
// lib/supabase/server.ts — RSC/Route Handler용
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createClient() {
  const cookieStore = await cookies()
  const nickname = cookieStore.get('nickname')?.value ?? '익명'
  const client = createServerClient(URL, KEY, { cookies: cookieStore })
  await client.rpc('set_user_context', { p_nickname: nickname })
  return client
}

// lib/supabase/client.ts — 클라이언트 컴포넌트용
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  const nickname = localStorage.getItem('nickname') ?? '익명'
  const client = createBrowserClient(URL, KEY)
  // 편집 mutation 실행 전에 호출
  await client.rpc('set_user_context', { p_nickname: nickname })
  return client
}
```

### 환경 변수

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- 인증 없는 열린 편집이므로 `anon` 키만 사용 (service_role key는 사용 금지 — 클라이언트 노출 위험)
- 두 변수 모두 `NEXT_PUBLIC_` 접두사로 클라이언트 접근 허용 (RLS가 보안 담당)

---

## 8. 구현 단계, 테스트, YAGNI

### 구현 단계 (7단계 순차)

```
1단계: 기반       2단계: 데이터      3단계: 조회      4단계: 편집
─────────────  ─────────────  ─────────────  ─────────────
스캐폴드       스키마+RLS      대시보드      인라인편집
shadcn 설정    마이그레이션     팀 워크스페이스  낙관적업데이트
레이아웃       마크다운 이주    간트 차트      audit 트리거
              시드 데이터      체크리스트    닉네임 식별

5단계: 안전망     6단계: UX 다듬기   7단계: 배포
─────────────  ─────────────  ─────────────
변경이력 뷰    반응형 튜닝     Vercel 배포
soft-delete    empty state    도메인/SEO
휴지통         로딩/에러 UI    최종 점검
동시편집 경고   다크모드(옵션)
```

**각 단계의 검증 기준:**

| 단계 | 완료 조건 | 배포 가능? |
|---|---|---|
| **1. 기반** | `npm run dev`로 빈 레이아웃 + 사이드바 표시 | ✅ |
| **2. 데이터** | Supabase 로컬에서 시드 데이터 조회 가능 | — |
| **3. 조회** | 4개 화면 모든 데이터 표시 (읽기 전용) | ✅ 첫 배포 |
| **4. 편집** | 체크박스 토글, 결정 상태 변경, 마크다운 편집 | ✅ |
| **5. 안전망** | audit_log 기록, 삭제 복원 작동 | ✅ |
| **6. UX** | 모바일/태블릿/데스크톱 모두 사용 가능 | ✅ |
| **7. 배포** | Vercel + Supabase 프로덕션 URL 접속 | ✅ 최종 |

**핵심 원칙: 3단계(조회) 완료 시 첫 배포.** 이후 단계는 점진적 추가. "빈 페이지"를 오래 두지 않는다.

### 테스트 전략

무거운 E2E 프레임워크(Cypress/Playwright)는 YAGNI로 분류한다.

| 계층 | 도구 | 무엇을 검증 |
|---|---|---|
| **데이터 스키마** | `lib/types/models.ts`의 Zod 스키마 | API 응답/입력이 모델과 일치 |
| **마크다운 이주** | `scripts/migrate-from-md.ts`에 대한 단위 테스트 | 5개 md 파일이 정확히 파싱되는지 (decisions 7개, milestones 수, checklist 수) |
| **쿼리 함수** | 단위 테스트 (모킹 Supabase) | CRUD 함수가 올바른 쿼리 생성 |
| **UI 스모크** | 수동 검증 체크리스트 | 4개 화면 렌더링, 주요 편집 흐름 |

**마크다운 이주 테스트가 가장 중요하다.** 이주가 틀리면 전체 데이터가 잘못 들어가므로, 이 스크립트는 단위 테스트 필수 — 각 마크다운 파일별로 "이 섹션은 N개의 항목을 만들어야 한다"는 단언을 둔다.

### YAGNI — 명시적으로 제외하는 것

| 제외 항목 | 이유 | 필요해지면 |
|---|---|---|
| **사용자 인증** | 열린 편집 선택 | 닉네임→로그인으로 확장 |
| **실시간 동기화** | 비용 우선 | Supabase Realtime 무료 한도 내에서 추가 가능 |
| **댓글/멘션/알림** | 회의 중 쓸 일 적 | 슬랙/카톡이 이미 역할 |
| **파일 업로드** | 마크다운 텍스트가 주 콘텐츠 | 배치도 이미지 등 필요 시 Storage 추가 |
| **다국어(i18n)** | 팀원용이므로 한국어 단일 | 교환학생 페이지만 영어版 별도 가능 |
| **권한 분리** | 열린 편집 | 팀별 편집 권한 필요 시 RLS 강화 |
| **E2E 자동화** | 단위 테스트+수동으로 충분 | 회귀 위험 커지면 Playwright 도입 |
| **모바일 앱** | 반응형 웹으로 충분 | PWA 매니페스트 정도는 저렴하게 가능 |
| **CI/CD 파이프라인** | Vercel 자동 배포로 충분 | 테스트 늘어나면 GitHub Actions |

### 성공 기준 (Definition of Done)

- [ ] **4개 화면 모두 작동**: 대시보드, 팀 워크스페이스, 간트, 체크리스트
- [ ] **마크다운 이주 완료**: 5개 md 파일의 데이터가 DB에 정확히 반영 (이주 결과 리포트로 확인)
- [ ] **편집 기능 작동**: 체크 토글, 결정 상태 변경, 마크다운 편집, 항목 추가/삭제
- [ ] **안전망 작동**: audit_log 기록, 닉네임 표시, 삭제 복원
- [ ] **반응형**: 모바일/태블릿/데스크톱에서 사용 가능
- [ ] **배포**: Vercel + Supabase 프로덕션 URL로 팀원 접속 가능
- [ ] **비용 0원**: 모두 무료 티어 내

### 리스크와 대응

| 리스크 | 확률 | 영향 | 대응 |
|---|---|---|---|
| 마크다운 이주 파싱 오류 | 중 | 높음 | 단위 테스트 + 이주 결과 리포트로 사전 검증 |
| Supabase 무료 50,000 row 한도 | 낮음 | 중 | audit_log가 주요 소비원 → 30일 후 정리 cron |
| 간트 차트 자체 구현 복잡도 | 중 | 중 | 단순 타임라인 리스트로 후퇴 가능 (폴백) |
| 열린 편집 악의적 삭제 | 낮음 | 높음 | soft-delete + audit_log + 30일 복원 창 |
| 동시 편집 충돌 | 중 | 낮음 | last-write-wins + updated_at 경고로 완화 |

---

## 9. 참고 자료

- 마스터 지침: `26-2 Sports Day/00_기획지침_마스터.md`
- 팀 지침: `26-2 Sports Day/{컨텐츠팀,예산팀,교환담당팀,타임라인_인원관리팀}/*_지침.md`
- 회의 3단 분류 SSOT: `docs/superpowers/specs/2026-08-05-2차회의-수정안-design.md`
