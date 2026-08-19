import { describe, it, expect } from 'vitest'
import { buildKakaoDigest } from '@/lib/kakao-digest'
import type { Handoff, Milestone, MilestoneCategory, Team, TeamId } from '@/lib/types/models'

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
})
