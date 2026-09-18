import { describe, it, expect } from 'vitest'
import {
  ROSTER_NAMES,
  MR6,
  TEAMLEADS,
  VICELEADS,
  JUKSIK,
  MC,
  MAPLE6,
  GAMES,
  MORNING,
  LUNCH,
  AFTERNOON,
  FLOW,
  GATHER,
} from '@/lib/dayof/data'

// 데이터 원천: _briefing_build/roster.js 스냅샷 + 2026-09-18 최종기획안 시트2 원본 대조 반영.
// 여기서 깨지면 변환 과정에서 데이터가 유실/변형된 것이다.

describe('dayof/data 명단', () => {
  it('ROSTER_NAMES은 중복 없다', () => {
    expect(new Set(ROSTER_NAMES).size).toBe(ROSTER_NAMES.length)
  })

  it('ROSTER_NAMES은 가나다순 정렬이다', () => {
    const sorted = [...ROSTER_NAMES].sort((a, b) => a.localeCompare(b, 'ko'))
    expect(ROSTER_NAMES).toEqual(sorted)
  })

  it('인원 = 54명 (하클 48 + 메이플 지원 6)', () => {
    expect(ROSTER_NAMES.length).toBe(54)
  })

  it('핵심 직제 명단 전원이 ROSTER_NAMES에 포함된다', () => {
    for (const name of [...MR6, ...TEAMLEADS, ...VICELEADS, ...JUKSIK, ...MC, ...MAPLE6]) {
      expect(ROSTER_NAMES).toContain(name)
    }
  })
})

describe('dayof/data 게임', () => {
  it('게임은 6종이며 필수 필드가 있다', () => {
    expect(GAMES).toHaveLength(6)
    for (const g of GAMES) {
      expect(g.idx).toBeGreaterThan(0)
      expect(g.name.length).toBeGreaterThan(0)
      expect(g.time).toMatch(/^\d{2}:\d{2}/)
      expect(g.assign.length).toBeGreaterThan(0)
      expect(g.judge.length).toBeGreaterThan(0)
      expect(g.items.length).toBeGreaterThan(0)
    }
  })

  it('assign 엔트리는 전부 "역할 — 이름" 형식이다', () => {
    for (const g of GAMES) {
      for (const a of g.assign) {
        expect(a).toContain(' — ')
      }
    }
  })
})

describe('dayof/data 배치·플로우 형식', () => {
  it('모든 타임슬롯의 time은 HH:MM으로 시작한다', () => {
    for (const slot of [...MORNING, ...LUNCH]) {
      expect(slot.time).toMatch(/^\d{2}:\d{2}/)
      for (const row of slot.rows) {
        if (row.k === 'H') {
          expect(row.l.role.length).toBeGreaterThan(0)
        }
      }
    }
    for (const slot of AFTERNOON) {
      expect(slot.time).toMatch(/^\d{2}:\d{2}/)
    }
  })

  it('AFTERNOON 행은 자유 텍스트 문자열이다', () => {
    for (const slot of AFTERNOON) {
      for (const row of slot.rows) {
        expect(typeof row).toBe('string')
      }
    }
  })

  it('FLOW는 6단계이며 이름 명단 문자열을 가진다', () => {
    expect(FLOW).toHaveLength(6)
    for (const step of FLOW) {
      expect(step.n.length).toBeGreaterThan(0)
      expect(step.d.length).toBeGreaterThan(0)
    }
  })

  it('GATHER 양쪽 조(명륜/율전) 행이 있다', () => {
    expect(GATHER.myeongryun.rows.length).toBeGreaterThan(0)
    expect(GATHER.yuljeon.rows.length).toBeGreaterThan(0)
    expect(GATHER.chips.length).toBeGreaterThan(0)
  })
})
