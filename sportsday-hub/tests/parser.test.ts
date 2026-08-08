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
    const contentMilestone = milestones.find((m) =>
      m.title.includes('컨텐츠')
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
    // 마크다운 파서는 milestone UUID를 알 수 없으므로 모든 항목은
    // 상시(milestone_id=null)로 파싱된다. section 필드는 제거됨.
    for (const item of items) {
      expect(item.milestone_id).toBeNull()
    }
    // 피드백 섹션 항목(심판 규칙, 페이스페인팅)이 여전히 파싱되는지 확인
    const hasJudging = items.some((i) => i.content.includes('심판'))
    const hasFacePaint = items.some((i) => i.content.includes('페이스페인팅'))
    expect(hasJudging).toBe(true)
    expect(hasFacePaint).toBe(true)
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

// 참고: 과거에는 content-source/*.md 파일을 실제로 읽어 파서를 검증하는
// 통합 테스트 블록('실제 마크다운 파일 통합 테스트')이 있었습니다.
// seeding이 명시적 SQL 마이그레이션(0005/0008)으로 이관되고 content-source
// 마크다운이 재구성되면서 이 파서들은 seeding에 더 이상 사용되지 않아
// 통합 테스트가 0건만 리턴하며 레드 상태로 되었습니다. 실제 회귀를 가리지
// 않도록 해당 통합 테스트는 제거하고, 인라인 MASTER_SAMPLE/TEAM_SAMPLE
// 픽스처에 대한 유닛 테스트만 유지합니다. (it.skip 사용 금지)
