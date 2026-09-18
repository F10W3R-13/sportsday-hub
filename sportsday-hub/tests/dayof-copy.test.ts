import { describe, it, expect } from 'vitest'
import {
  GAME_ROLE_COPY,
  TASK_KEYWORD_COPY,
  displayTitle,
  friendlyFor,
  warnFriendly,
} from '@/lib/dayof/copy'
import { GAMES, ROSTER_NAMES, WARN4 } from '@/lib/dayof/data'
import { getScheduleFor, getWarningsFor } from '@/lib/dayof/schedule'

// 작가 사전 품질 게이트 — 사전에 없는 배정이 생기면 여기서 깨진다.

describe('dayof/copy 게임 역할 사전', () => {
  it('모든 게임 배정 역할에 친절 설명이 있다', () => {
    for (const game of GAMES) {
      for (const entry of game.assign) {
        const [role] = entry.split(' — ')
        const key = `${game.idx}::${role}`
        expect(GAME_ROLE_COPY[key], key).toBeDefined()
        expect(GAME_ROLE_COPY[key].length, key).toBeGreaterThan(20)
      }
    }
  })
})

describe('dayof/copy 일반 업무 사전', () => {
  it('키워드 사전의 키는 중복 없다', () => {
    const keys = TASK_KEYWORD_COPY.map(([k]) => k)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('전 항목의 85% 이상에 친절 설명이 붙는다', () => {
    let total = 0
    let covered = 0
    for (const name of ROSTER_NAMES) {
      for (const item of getScheduleFor(name)) {
        total += 1
        if (friendlyFor(item) !== undefined) covered += 1
      }
    }
    expect(covered / total).toBeGreaterThanOrEqual(0.85)
  })

  it('설명이 없는 항목은 undefined (추측 문장 금지)', () => {
    expect(friendlyFor({ time: '00:00', sortKey: 0, title: '세상에 없는 업무', source: 'slot' })).toBeUndefined()
  })
})

describe('dayof/copy 대표 케이스', () => {
  it('이현서 · 색깔 판 주심 — 호루라기 안내 포함', () => {
    const item = getScheduleFor('이현서').find((i) => i.gameIdx === 1)
    expect(friendlyFor(item!)).toContain('호루라기')
  })

  it('이현서 · 플로우 점심 배부 — 도시락 설명', () => {
    const item = getScheduleFor('이현서').find(
      (i) => i.source === 'flow' && i.title.includes('배부')
    )
    expect(friendlyFor(item!)).toContain('도시락')
  })

  it('전원 · 뒷정리 — 천막 철거 안내', () => {
    const item = getScheduleFor('성현중').find((i) => i.title.includes('뒷정리'))
    expect(friendlyFor(item!)).toContain('천막')
  })
})

describe('displayTitle — 작가 시점 제목', () => {
  it('전원 전 항목의 제목에 어떤 사람 이름도 남지 않는다', () => {
    for (const name of ROSTER_NAMES) {
      for (const item of getScheduleFor(name)) {
        const t = displayTitle(item)
        for (const other of ROSTER_NAMES) {
          expect(t.includes(other), `${name} / ${item.title} / ${other}`).toBe(false)
        }
      }
    }
  })

  it('오전 배정 없는 사람의 첫 항목 — "그 외 전원" 대신 바로 와닿는 제목 (김나경)', () => {
    expect(displayTitle(getScheduleFor('김나경')[0])).toBe('본인 팀 천막 대기 (개별 배정 없는 시간)')
  })

  it('부스 노래 — 동료 이름(김나경) 제거', () => {
    const item = getScheduleFor('이현서').find((i) => i.title.includes('부스 노래'))
    expect(displayTitle(item!)).toBe('부스 노래(BGM)')
  })

  it('공통 원문은 제목 교체 후에도 드롭다운 원문으로 보존된다', () => {
    const first = getScheduleFor('김나경')[0]
    expect(first.title).toContain('그 외 전원') // 원문 필드는 불변
  })
})

describe('warnFriendly', () => {
  it('WARN4 전 건에 친절 설명이 있다', () => {
    for (const w of WARN4) {
      expect(warnFriendly(w), w).toBeDefined()
    }
  })

  it('게임 warn(색깔 판 보조 부족)도 설명이 붙는다', () => {
    const warns = getWarningsFor('이강서') // 게임 1 게임 보조
    const game1Warn = warns.find((w) => w.includes('보조 4명'))
    expect(game1Warn).toBeDefined()
    expect(warnFriendly(game1Warn!)).toBeDefined()
  })
})
