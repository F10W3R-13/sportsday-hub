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

// ▶ 데이터 린터 — data.ts 를 올해 명단으로 교체한 뒤 이 테스트가 전부 통과하면
// 구조·참조 무결성이 확보된 것이다. 깨지면 지시하는 메시지가 실수의 내용이다.
// (26-2 실데이터 시절의 고정 카운트 검증(54명·게임 6종)은 일반형으로 대체)

describe('dayof/data 명단', () => {
  it('ROSTER_NAMES은 중복 없다', () => {
    expect(new Set(ROSTER_NAMES).size).toBe(ROSTER_NAMES.length)
  })

  it('ROSTER_NAMES은 가나다순 정렬이다', () => {
    const sorted = [...ROSTER_NAMES].sort((a, b) => a.localeCompare(b, 'ko'))
    expect(ROSTER_NAMES).toEqual(sorted)
  })

  it('ROSTER_NAMES은 최소 1명 이다', () => {
    expect(ROSTER_NAMES.length).toBeGreaterThan(0)
  })

  it('핵심 직제 명단 전원이 ROSTER_NAMES에 포함된다', () => {
    for (const name of [...MR6, ...TEAMLEADS, ...VICELEADS, ...JUKSIK, ...MC, ...MAPLE6]) {
      expect(ROSTER_NAMES, name).toContain(name)
    }
  })
})

describe('dayof/data 게임', () => {
  it('게임은 최소 1종이며 필수 필드가 있다', () => {
    expect(GAMES.length).toBeGreaterThan(0)
    for (const g of GAMES) {
      expect(g.name.length).toBeGreaterThan(0)
      expect(g.time).toMatch(/^\d{2}:\d{2}/)
      expect(g.assign.length).toBeGreaterThan(0)
      expect(g.judge.length).toBeGreaterThan(0)
      expect(g.items.length).toBeGreaterThan(0)
    }
  })

  it('게임 idx는 1부터 순서대로 매겨진다', () => {
    GAMES.forEach((g, i) => expect(g.idx, g.name).toBe(i + 1))
  })

  it('assign 엔트리는 전부 "역할 — 이름" 형식이다', () => {
    for (const g of GAMES) {
      for (const a of g.assign) {
        expect(a, `${g.name}: ${a}`).toContain(' — ')
      }
    }
  })

  it('assign 우변의 모든 이름이 ROSTER_NAMES에 있다 (오타 방지)', () => {
    for (const g of GAMES) {
      for (const a of g.assign) {
        const right = a.split(' — ')[1] ?? ''
        for (const token of right.split(' · ')) {
          const name = token.replace(/\s*외.*$/, '').trim()
          if (!name) continue
          expect(ROSTER_NAMES, `${g.name} / ${a} / ${token}`).toContain(name)
        }
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

  it('슬롯 lead·members 의 모든 이름이 ROSTER_NAMES에 있다 (오타 방지)', () => {
    for (const slot of [...MORNING, ...LUNCH]) {
      for (const row of slot.rows) {
        if (row.k === 'F') {
          const lead = row.lead.replace(/\s*외.*$/, '').trim()
          expect(ROSTER_NAMES, `${slot.time} / ${row.role}`).toContain(lead)
          for (const m of row.members ?? []) {
            expect(ROSTER_NAMES, `${slot.time} / ${row.role} / ${m}`).toContain(m)
          }
        } else if (row.k === 'H') {
          for (const cell of [row.l, row.r]) {
            if (!cell?.lead && !cell?.members) continue
            const lead = (cell.lead ?? '').replace(/\s*외.*$/, '').trim()
            if (lead) expect(ROSTER_NAMES, `${slot.time} / ${cell.role}`).toContain(lead)
            for (const m of cell.members ?? []) {
              expect(ROSTER_NAMES, `${slot.time} / ${cell.role} / ${m}`).toContain(m)
            }
          }
        }
      }
    }
  })

  it('FLOW는 최소 1단계이며 이름 명단 문자열을 가진다', () => {
    expect(FLOW.length).toBeGreaterThan(0)
    for (const step of FLOW) {
      expect(step.n.length).toBeGreaterThan(0)
      expect(step.d.length).toBeGreaterThan(0)
    }
  })

  it('GATHER 양쪽 조 행이 있다', () => {
    expect(GATHER.myeongryun.rows.length).toBeGreaterThan(0)
    expect(GATHER.yuljeon.rows.length).toBeGreaterThan(0)
    expect(GATHER.chips.length).toBeGreaterThan(0)
  })
})
