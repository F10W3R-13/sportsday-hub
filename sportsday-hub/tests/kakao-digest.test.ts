import { describe, it, expect } from 'vitest'
import { buildKakaoDigest } from '@/lib/kakao-digest'
import type { ChecklistItem, Handoff, Milestone, MilestoneCategory, Team, TeamId } from '@/lib/types/models'

// 테스트 기준일: 2026-09-02
const NOW = new Date('2026-09-02T01:00:00Z')

function milestone(id: string, date: string, title = '항목', team_id: TeamId | null = null): Milestone {
  return {
    id,
    date,
    title,
    team_id,
    category: 'deliverable' as MilestoneCategory,
    completed: false,
    depends_on: null,
    sort_order: 0,
  }
}

function handoff(id: string, dueDate: string | null, title = '인계건', completed = false): Handoff {
  return {
    id,
    from_team_id: 'exchange' as TeamId,
    to_team_id: 'timeline' as TeamId,
    to_external: null,
    title,
    due_date: dueDate,
    completed,
    checklist_item_id: null,
    sort_order: 0,
  }
}

function checklistItem(
  id: string,
  milestoneId: string | null,
  content: string,
  completed = false,
  team_id: TeamId | null = null
): ChecklistItem {
  return {
    id,
    team_id,
    milestone_id: milestoneId,
    content,
    priority: 'medium',
    completed,
    source: null,
    sort_order: 0,
    deleted_at: null,
  }
}

const TEAMS: Team[] = [
  { id: 'exchange', name: '교환담당팀', name_en: 'exchange', color: '#000', icon: 'i', sort_order: 1, mission: 'm', guideline_doc: { sections: [] } },
  { id: 'timeline', name: '타임라인/인원관리팀', name_en: 'timeline', color: '#000', icon: 'i', sort_order: 2, mission: 'm', guideline_doc: { sections: [] } },
] as unknown as Team[]

describe('buildKakaoDigest', () => {
  it('임박 항목이 없으면 null', () => {
    const r = buildKakaoDigest(
      { milestones: [milestone('a', '2026-09-20')], handoffs: [], teams: TEAMS },
      { now: NOW }
    )
    expect(r).toBeNull()
  })

  it('완료 인계는 임박해도 제외', () => {
    const r = buildKakaoDigest(
      { milestones: [], handoffs: [handoff('h1', '2026-09-01', '완료된 인계', true)], teams: TEAMS },
      { now: NOW }
    )
    expect(r).toBeNull()
  })

  it('기한 없는 인계는 제외', () => {
    const r = buildKakaoDigest({ milestones: [], handoffs: [handoff('h1', null)], teams: TEAMS }, { now: NOW })
    expect(r).toBeNull()
  })

  it('지연/오늘/horizon 내 항목 포함, horizon 밖 제외', () => {
    const r = buildKakaoDigest(
      {
        milestones: [
          milestone('m1', '2026-08-31', '지연된 마일스톤'), // D+2
          milestone('m2', '2026-09-02', '오늘 마일스톤'), // 오늘
          milestone('m3', '2026-09-05', 'D-3 마일스톤'), // horizon 경계(기본 3)
          milestone('m4', '2026-09-06', 'horizon 밖'), // 제외
        ],
        handoffs: [handoff('h1', '2026-09-04', 'D-2 인계')],
        teams: TEAMS,
      },
      { now: NOW }
    )
    expect(r).not.toBeNull()
    expect(r!.text).toContain('D+2')
    expect(r!.text).toContain('지연된 마일스톤')
    expect(r!.text).toContain('오늘 마일스톤')
    expect(r!.text).toContain('D-3')
    expect(r!.text).toContain('D-2 인계')
    expect(r!.text).not.toContain('horizon 밖')
    expect(r!.total).toBe(4)
  })

  it('지연이 가장 앞에, 팀명 라벨 포함', () => {
    const r = buildKakaoDigest(
      {
        milestones: [milestone('m2', '2026-09-03', '구글폼 완성', 'exchange')],
        handoffs: [handoff('h1', '2026-08-30', '버스 탑승 명단')],
        teams: TEAMS,
      },
      { now: NOW }
    )
    expect(r!.text.indexOf('D+3')).toBeLessThan(r!.text.indexOf('D-1'))
    expect(r!.text).toContain('(교환담당')
    expect(r!.text).toContain('인계: 버스')
  })

  it('maxItems 초과 시 외 N건 표기, 200자 이내 유지', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      milestone(`m${i}`, '2026-09-02', `매우매우긴제목의마일스톤번호${i}`)
    )
    const r = buildKakaoDigest({ milestones: many, handoffs: [], teams: TEAMS }, { now: NOW, maxItems: 4 })
    expect(r!.text).toContain('외 26건')
    expect(r!.text.length).toBeLessThanOrEqual(200)
    expect(r!.total).toBe(30)
  })

  it('미완료 체크리스트가 있으면 마일스톤 줄은 생략하고 ☐ 항목만 표시', () => {
    const r = buildKakaoDigest(
      {
        milestones: [milestone('m1', '2026-09-03', '물품 수령')],
        handoffs: [],
        checklistItems: [
          checklistItem('c1', 'm1', '게임 물품 리스트 수령', false, 'exchange'),
          checklistItem('c2', 'm1', '이미 끝난 할 일', true),
        ],
        teams: TEAMS,
      },
      { now: NOW }
    )
    expect(r).not.toBeNull()
    expect(r!.text).toContain('☐ 게임 물품 리스트 수령')
    expect(r!.text).toContain('(교환담당')
    expect(r!.text).not.toContain('이미 끝난 할 일')
    expect(r!.text).not.toContain('물품 수령')
    expect(r!.total).toBe(1)
  })

  it('체크리스트가 전부 완료된 마일스톤은 마일스톤 줄로 표시', () => {
    const r = buildKakaoDigest(
      {
        milestones: [milestone('m1', '2026-09-03', '물품 수령')],
        handoffs: [],
        checklistItems: [checklistItem('c1', 'm1', '끝난 할 일', true)],
        teams: TEAMS,
      },
      { now: NOW }
    )
    expect(r).not.toBeNull()
    expect(r!.text).toContain('[D-1] 물품 수령')
    expect(r!.total).toBe(1)
  })

  it('마일스톤에 묶이지 않은 체크리스트는 제외', () => {
    const r = buildKakaoDigest(
      { milestones: [], handoffs: [], teams: TEAMS, checklistItems: [checklistItem('c1', null, '상시 할 일')] },
      { now: NOW }
    )
    expect(r).toBeNull()
  })

  it('연결 마일스톤이 horizon 밖이면 체크리스트도 제외', () => {
    const r = buildKakaoDigest(
      {
        milestones: [milestone('m1', '2026-09-20', '먼 미래')],
        handoffs: [],
        teams: TEAMS,
        checklistItems: [checklistItem('c1', 'm1', '먼 미래 할 일')],
      },
      { now: NOW }
    )
    expect(r).toBeNull()
  })

  it('같은 마일스톤의 체크리스트들은 모두 표시하고 마일스톤 줄은 생략', () => {
    const r = buildKakaoDigest(
      {
        milestones: [milestone('m1', '2026-09-02', '구글폼 배포')],
        handoffs: [],
        teams: TEAMS,
        checklistItems: [checklistItem('c1', 'm1', '구글폼 배포'), checklistItem('c2', 'm1', '다른 할 일')],
      },
      { now: NOW }
    )
    expect(r).not.toBeNull()
    expect(r!.text).toContain('☐ 구글폼 배포')
    expect(r!.text).toContain('☐ 다른 할 일')
    expect(r!.total).toBe(2)
  })

  it('detailed 스타일은 제목·팀명을 자르지 않고 설명형 라벨로 표시', () => {
    const longTitle = '하클 가용인원 파악 후 버스 배차 계획 수립하기'
    const r = buildKakaoDigest(
      {
        milestones: [
          milestone('m1', '2026-08-31', longTitle, 'timeline'),
          milestone('m2', '2026-09-02', '방중회의'),
        ],
        handoffs: [handoff('h1', '2026-09-04', '버스 탑승 명단')],
        teams: TEAMS,
        checklistItems: [checklistItem('c1', 'm2', '구글폼 배포', false, 'exchange')],
      },
      { now: NOW, style: 'detailed', maxItems: 20, textLimit: 2000 }
    )
    expect(r).not.toBeNull()
    expect(r!.text).toContain(longTitle)
    expect(r!.text).not.toContain('…')
    expect(r!.text).toContain('[기한 지연 (D+2)]')
    expect(r!.text).toContain('[오늘 마감]')
    expect(r!.text).toContain('[D-2 남음]')
    expect(r!.text).toContain('담당: 타임라인/인원관리팀')
    expect(r!.text).toContain('인수: 타임라인/인원관리팀')
    expect(r!.text).not.toContain('방중회의')
  })
})
