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

  // ── 자유 텍스트 필드의 오타 탐지 ──
  // GATHER.*.rows[].n · FLOW[].n 은 "이름 · 이름" 또는 설명어가 섞인 자유 텍스트라
  // 엄격한 명단 검증이 불가능하다. 대신 (1) 한 글자 차이(편집거리 1)로 명단과 어긋나는
  // 토큰을 "오타 의심"으로 잡고 (2) 각 행/단계가 이름이나 집합 표기를 최소 1개 포함하는지 확인한다.
  const GROUP_WORDS = ['팀장', '부팀장', '조별', '준비조', '전원', '외']

  function isEditDistance1(a: string, b: string): boolean {
    if (Math.abs(a.length - b.length) > 1) return false
    let i = 0
    let j = 0
    let diff = 0
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i++
        j++
        continue
      }
      if (++diff > 1) return false
      if (a.length === b.length) {
        i++
        j++
      } else if (a.length > b.length) i++
      else j++
    }
    return true
  }

  function suspiciousTokens(text: string): string[] {
    const tokens = text.match(/[가-힣]{2,}/g) ?? []
    return tokens.filter(
      (t) =>
        !ROSTER_NAMES.includes(t) &&
        !GROUP_WORDS.includes(t) &&
        ROSTER_NAMES.some((n) => isEditDistance1(n, t))
    )
  }

  it('GATHER·FLOW 자유 텍스트에 명단과 한 글자만 다른 이름이 없다 (오타 탐지)', () => {
    const texts: string[] = []
    for (const g of [GATHER.myeongryun, GATHER.yuljeon]) {
      for (const row of g.rows) texts.push(`${row.t} ${row.d} ${row.n}`)
    }
    for (const step of FLOW) texts.push(`${step.t} ${step.n}`)
    for (const text of texts) {
      const bad = suspiciousTokens(text)
      expect(bad, `${text} → ${bad.join(', ')}`).toEqual([])
    }
  })

  it('GATHER 각 행·FLOW 각 단계는 이름 또는 집합 표기를 최소 1개 포함한다', () => {
    const hasAssignee = (s: string) =>
      ROSTER_NAMES.some((n) => s.includes(n)) || GROUP_WORDS.some((w) => s.includes(w))
    for (const g of [GATHER.myeongryun, GATHER.yuljeon]) {
      for (const row of g.rows) {
        expect(hasAssignee(row.n), `${g.title} / ${row.d}`).toBe(true)
      }
    }
    for (const step of FLOW) {
      expect(hasAssignee(step.n), step.t).toBe(true)
    }
  })

  it('게임 별칭은 고유하며 서로를 가리지 않는다 (첫 매칭 승리 규칙 보호)', () => {
    const aliases = GAMES.map((g) => g.alias ?? g.name)
    expect(new Set(aliases).size).toBe(aliases.length)
    for (let i = 0; i < aliases.length; i++) {
      for (let j = i + 1; j < aliases.length; j++) {
        const shadow =
          aliases[i].includes(aliases[j]) || aliases[j].includes(aliases[i])
        expect(shadow, `"${aliases[i]}" vs "${aliases[j]}"`).toBe(false)
      }
    }
  })

  it('모든 게임 별칭이 오후 배치 텍스트에 최소 1회 등장한다 (오후↔카드 중복 제거 매칭용)', () => {
    const afternoonAll = AFTERNOON.map((s) => s.rows.join('\n')).join('\n')
    for (const g of GAMES) {
      expect(afternoonAll.includes(g.alias ?? g.name), g.name).toBe(true)
    }
  })
})
