import { describe, it, expect } from 'vitest'
import { buildKakaoDigest } from '@/lib/kakao-digest'
import type { Handoff, Milestone, MilestoneCategory, Team, TeamId } from '@/lib/types/models'

// 테스트 기준시: 2026-09-02
const NOW = new Date('2026-09-02T01:00:00Z')

function milestone(
  id: string,
  date: string | null,
  title = '테스트',
  team_id: TeamId | null = null,
  completed = false
): Milestone {
  return {
    id,
    date,
    title,
    team_id,
    category: 'deliverable' as MilestoneCategory,
    completed,
    depends_on: null,
    sort_order: 0,
  }
}

function handoff(id: string, dueDate: string | null, title = '인계명', completed = false): Handoff {
  return {
    id,
    from_team_id: 'exchange' as TeamId,
    to_team_id: 'timeline' as TeamId,
    to_external: null,
    title,
    due_date: dueDate,
    completed,
    item_id: null,
    sort_order: 0,
  }
}

const TEAMS: Team[] = [
  { id: 'exchange', name: '교환학생팀', name_en: 'exchange', color: '#000', icon: 'i', sort_order: 1, mission: 'm', guideline_doc: { sections: [] } },
  { id: 'timeline', name: '타임라인/인력운영팀', name_en: 'timeline', color: '#000', icon: 'i', sort_order: 2, mission: 'm', guideline_doc: { sections: [] } },
] as unknown as Team[]

describe('buildKakaoDigest', () => {
  it('임박 항목이 없으면 null', () => {
    const r = buildKakaoDigest(
      { tasks: [milestone('a', '2026-09-20')], handoffs: [], teams: TEAMS },
      { now: NOW }
    )
    expect(r).toBeNull()
  })

  it('완료된 인계는 제외', () => {
    const r = buildKakaoDigest(
      { tasks: [], handoffs: [handoff('h1', '2026-09-01', '완료된 인계', true)], teams: TEAMS },
      { now: NOW }
    )
    expect(r).toBeNull()
  })

  it('기한 없는 인계 제외', () => {
    const r = buildKakaoDigest({ tasks: [], handoffs: [handoff('h1', null)], teams: TEAMS }, { now: NOW })
    expect(r).toBeNull()
  })

  it('완료된 작업(마일스톤 통합 항목)은 제외', () => {
    const r = buildKakaoDigest(
      { tasks: [milestone('a', '2026-09-01', '끝난 할 일', null, true)], handoffs: [], teams: TEAMS },
      { now: NOW }
    )
    expect(r).toBeNull()
  })

  it('상시(날짜 없는) 마일스톤은 제외', () => {
    const r = buildKakaoDigest(
      { tasks: [milestone('a', null, '상시 할 일')], handoffs: [], teams: TEAMS },
      { now: NOW }
    )
    expect(r).toBeNull()
  })

  it('지연/오늘/horizon 내 항목 포함, horizon 밖 제외', () => {
    const r = buildKakaoDigest(
      {
        tasks: [
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

  it('지연이 앞에 오고, 팀 이름 표시', () => {
    const r = buildKakaoDigest(
      {
        tasks: [milestone('m2', '2026-09-03', '내일할 일', 'exchange')],
        handoffs: [handoff('h1', '2026-08-30', '카드 대조 인계')],
        teams: TEAMS,
      },
      { now: NOW }
    )
    expect(r!.text.indexOf('D+3')).toBeLessThan(r!.text.indexOf('D-1'))
    expect(r!.text).toContain('(교환학생')
    expect(r!.text).toContain('인계: 카드')
  })

  it('maxItems 초과 시 …외 N건 표기, 200자 이내 유지', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      milestone(`m${i}`, '2026-09-02', `엄청엄청긴작업제목마일스톤테스트${i}`)
    )
    const r = buildKakaoDigest({ tasks: many, handoffs: [], teams: TEAMS }, { now: NOW, maxItems: 4 })
    expect(r!.text).toContain('외 26건')
    expect(r!.text.length).toBeLessThanOrEqual(200)
    expect(r!.total).toBe(30)
  })

  it('detailed 스타일에서는 잘리지 않고 설명형 라벨로 표기', () => {
    const longTitle = '클럽 하우스 앞 스탠드 존 운영 세부 물품 배치 계획 확정하기'
    const r = buildKakaoDigest(
      {
        tasks: [
          milestone('m1', '2026-08-31', longTitle, 'timeline'),
          milestone('m2', '2026-09-02', '총회개최'),
        ],
        handoffs: [handoff('h1', '2026-09-04', '카드 대조 완료')],
        teams: TEAMS,
      },
      { now: NOW, style: 'detailed', maxItems: 20, textLimit: 2000 }
    )
    expect(r).not.toBeNull()
    expect(r!.text).toContain(longTitle)
    expect(r!.text).not.toContain('…')
    expect(r!.text).toContain('[기한 지연 (D+2)]')
    expect(r!.text).toContain('[오늘 마감]')
    expect(r!.text).toContain('[D-2 남음]')
    expect(r!.text).toContain('담당: 타임라인/인력운영팀')
    expect(r!.text).toContain('인수: 타임라인/인력운영팀')
  })
})
