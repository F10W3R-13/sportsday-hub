import { describe, it, expect } from 'vitest'
import { buildKakaoDigest } from '@/lib/kakao-digest'
import type { Handoff, Milestone, MilestoneCategory, Team, TeamId } from '@/lib/types/models'

// 테스트 기준시: 2026-09-02 10:00 KST (수요일)
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
  it('임박 없어도 null 아님 — 마감 없음 안내 + 다음 마감 표기', () => {
    const r = buildKakaoDigest(
      { tasks: [milestone('a', '2026-09-20', 'Sports Day')], handoffs: [], teams: TEAMS },
      { now: NOW }
    )
    expect(r).not.toBeNull()
    expect(r.urgent).toBe(false)
    expect(r.total).toBe(0)
    expect(r.text).toContain('오늘 마감 없음')
    expect(r.text).toContain('다음: 9/20(일) Sports Day')
    expect(r.text).toContain('9/2(수)') // 헤더 날짜는 KST 기준
  })

  it('완료된 인계·기한 없는 인계·완료 작업은 제외', () => {
    const r = buildKakaoDigest(
      {
        tasks: [milestone('a', '2026-09-01', '끝난 할 일', null, true)],
        handoffs: [handoff('h1', '2026-09-01', '완료된 인계', true), handoff('h2', null)],
        teams: TEAMS,
      },
      { now: NOW }
    )
    expect(r.urgent).toBe(false)
    expect(r.text).toContain('오늘 마감 없음')
  })

  it('상시(날짜 없는) 항목은 본문 미포함, detailed에서 카운트만', () => {
    const compact = buildKakaoDigest(
      { tasks: [milestone('a', null, '상시 할 일')], handoffs: [], teams: TEAMS },
      { now: NOW }
    )
    expect(compact.urgent).toBe(false)
    expect(compact.text).not.toContain('상시 할 일')

    const detailed = buildKakaoDigest(
      { tasks: [milestone('a', null, '상시 할 일'), milestone('b', '2026-09-03', '내일 할 일')], handoffs: [], teams: TEAMS },
      { now: NOW, style: 'detailed', textLimit: 2000 }
    )
    expect(detailed.text).not.toContain('· 상시 할 일')
    expect(detailed.text).toContain('상시 과제 1건 · 완료체크 ▸')
    expect(detailed.urgent).toBe(true)
  })

  it('지연/오늘/D-3 본문 포함, D-4는 예고 줄에만', () => {
    const r = buildKakaoDigest(
      {
        tasks: [
          milestone('m1', '2026-08-31', '지연된 마일스톤'), // D+2
          milestone('m2', '2026-09-02', '오늘 마일스톤'),
          milestone('m3', '2026-09-05', 'D-3 마일스톤'),
          milestone('m4', '2026-09-06', '예고만_마일스톤'), // D-4
        ],
        handoffs: [handoff('h1', '2026-09-04', 'D-2 인계')],
        teams: TEAMS,
      },
      { now: NOW }
    )
    expect(r.urgent).toBe(true)
    expect(r.total).toBe(4)
    expect(r.text).toContain('지연 1건')
    expect(r.text).toContain('지연된 마일스톤(D+2)')
    expect(r.text).toContain('오늘 9/2(수) 1건')
    expect(r.text).toContain('9/5(토) 1건')
    expect(r.text).toContain('D-2 인계')
    expect(r.text).not.toContain('· 예고만_마일스톤') // 본문 미포함
    expect(r.text).toContain('외 D-7 내 1건') // 예고 줄
    expect(r.text).toContain('다음 9/6(일) 예고만')
  })

  it('지연 그룹이 미래 그룹보다 먼저 오고 팀을 붙인다', () => {
    const r = buildKakaoDigest(
      {
        tasks: [milestone('m2', '2026-09-03', '내일할 일', 'exchange')],
        handoffs: [handoff('h1', '2026-08-30', '카드 대조 인계')],
        teams: TEAMS,
      },
      { now: NOW }
    )
    expect(r.text.indexOf('D+3')).toBeLessThan(r.text.indexOf('9/3(목)'))
    expect(r.text).toContain('(교환학') // compact 팀 축약
    expect(r.text).toContain('카드 대조 인계')
  })

  it('detailed 스타일: ⚠/📅 그룹헤더 + [팀태그] 제목 + 그룹 사이 빈 줄', () => {
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
      { now: NOW, style: 'detailed', maxItems: 100, textLimit: 2000 }
    )
    expect(r.text).toContain('⚠ 8/31(월) 마감 · 2일 지연 1건')
    expect(r.text).toContain('[인관] 클럽 하우스 앞 스탠드 존 운영 세부 물품…') // 24자 축약, 괄호 상세 제거
    expect(r.text).toContain('📅 오늘 9/2(수) 마감 1건')
    expect(r.text).toContain('[전체] 총회개최')
    expect(r.text).toContain('[교환→인관] 카드 대조 완료') // 인계는 보내는→받는 팀 태그
    expect(r.text).toContain('완료체크 ▸ ')
    expect(r.text).toMatch(/\n\n(⚠|📅)/) // 그룹 사이 빈 줄
  })

  it('detailed: 괄호 상세는 제거, 동명 제목만 첫 괄호로 구분', () => {
    const r = buildKakaoDigest(
      {
        tasks: [
          milestone('m1', '2026-09-03', '티셔츠 사이즈별 집계 (S~3XL)', 'exchange'),
          milestone('m2', '2026-09-03', '버스 탑승 명단 작성 (명륜 2대 분할 / Suwon 직행 — 25-2 버스 80석 기준)', 'exchange'),
          milestone('m3', '2026-09-03', '버스 탑승 명단 작성 (교환담당팀에서 전달)', 'timeline'),
        ],
        handoffs: [],
        teams: TEAMS,
      },
      { now: NOW, style: 'detailed', textLimit: 2000 }
    )
    expect(r.text).toContain('[교환] 티셔츠 사이즈별 집계') // 유일 제목은 괄호 제거
    expect(r.text).toContain('[교환] 버스 탑승 명단 작성 (명륜 2대 분할 /…') // 동명은 첫 괄호 10자
    expect(r.text).toContain('[인관] 버스 탑승 명단 작성 (교환담당팀에서 전달)')
  })

  it('maxItems 초과 시 …외 N건 표기, 200자 이내 유지', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      milestone(`m${i}`, '2026-09-02', `엄청엄청긴작업제목마일스톤테스트${i}`)
    )
    const r = buildKakaoDigest({ tasks: many, handoffs: [], teams: TEAMS }, { now: NOW, maxItems: 4 })
    expect(r.text).toContain('외 26건')
    expect(r.text.length).toBeLessThanOrEqual(200)
    expect(r.total).toBe(30)
  })

  it('다음 마감이 D-7 밖이어도 안내에 표기된다', () => {
    const r = buildKakaoDigest(
      { tasks: [milestone('a', '2026-10-01', '10월 과제')], handoffs: [], teams: TEAMS },
      { now: NOW }
    )
    expect(r.text).toContain('다음: 10/1(목) 10월 과제')
    expect(r.text).not.toContain('외 D-7 내')
  })
})
