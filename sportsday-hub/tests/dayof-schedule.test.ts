import { describe, it, expect } from 'vitest'
import {
  listNames,
  getProfile,
  getScheduleFor,
  getWarningsFor,
} from '@/lib/dayof/schedule'
import { ROSTER_NAMES, TEAMLEADS } from '@/lib/dayof/data'

// getScheduleFor는 이름 하나를 넣으면 당일 시간순 배치 전체를 돌려주는
// 순수 함수다. 여기 깨지면 파싱 규칙(lead 확장·경계 매칭·중복 제거)이 무너진 것.

describe('listNames', () => {
  it('전체 명단(48명)을 가나다순으로 반환한다', () => {
    expect(listNames()).toEqual(ROSTER_NAMES)
  })
})

describe('getScheduleFor', () => {
  it('명단에 없는 이름이면 에러를 낸다', () => {
    expect(() => getScheduleFor('홍길동')).toThrow()
  })

  it('전원이 최소 1개 항목을 갖는다 (배치 누락 없음)', () => {
    for (const name of ROSTER_NAMES) {
      const items = getScheduleFor(name)
      expect(items.length, name).toBeGreaterThan(0)
    }
  })

  it('항목은 시작 시각 오름차순이다', () => {
    for (const name of ROSTER_NAMES) {
      const keys = getScheduleFor(name).map((i) => i.sortKey)
      const sorted = [...keys].sort((a, b) => a - b)
      expect(keys, name).toEqual(sorted)
    }
  })

  it('게임 주심 — 역할과 judge 세부 설명이 붙는다 (이현서·색깔 판)', () => {
    const items = getScheduleFor('이현서')
    const g = items.find((i) => i.gameIdx === 1)
    expect(g?.role).toBe('주심')
    expect(g?.title).toContain('색깔 판 뒤집기')
    expect(g?.detail).toContain('호루라기')
    // 오후 자유 텍스트의 동일 배정("색깔 판 뒤집기 13:30~14:10 — 주심 이현서")은 중복 제거
    expect(items.some((i) => i.title.includes('색깔 판 뒤집기 13:30'))).toBe(false)
  })

  it('오후 자유 텍스트 — 역할이 다르면 유지된다 (강단비·짝 찾기 리드)', () => {
    const items = getScheduleFor('강단비')
    expect(items.some((i) => i.title.includes('리드 강단비'))).toBe(true)
  })

  it('오후 상시 행은 담당 세그먼트로 분할된다 (이현지·도장/뽑기/간식)', () => {
    const items = getScheduleFor('이현지')
    expect(items.some((i) => i.title.includes('도장/뽑기/간식'))).toBe(true)
  })

  it('집계 담당 — 플로우 출석 체크와 상시 점수 집계가 모두 잡힌다 (고연준)', () => {
    const items = getScheduleFor('고연준')
    expect(items.some((i) => i.source === 'flow' && i.title.includes('출석 체크'))).toBe(true)
    expect(items.some((i) => i.title.includes('점수 집계'))).toBe(true)
  })

  it('"배현빈 외 팀장 6" — 팀장 전원이 팀별 소집 항목을 받는다', () => {
    for (const lead of TEAMLEADS) {
      expect(
        getScheduleFor(lead).some((i) => i.title.includes('팀별 소집')),
        lead
      ).toBe(true)
    }
  })

  it('공통 항목 — 전원이 천막 대기(11:50)와 뒷정리(18:00)를 받는다', () => {
    for (const name of ROSTER_NAMES) {
      const items = getScheduleFor(name)
      expect(items.some((i) => i.title.includes('본인 팀 천막 대기')), name).toBe(true)
      expect(items.some((i) => i.title.includes('뒷정리')), name).toBe(true)
    }
  })

  it('아침 집합 — GATHER 명단 항목이 시간순 맨 앞에 온다 (이강서·물품 상차)', () => {
    const items = getScheduleFor('이강서')
    expect(items[0].source).toBe('gather')
    expect(items[0].title).toContain('물품 상차')
  })

  it('이름 경계 매칭 — 이현지는 이현서의 게임 배정을 받지 않는다', () => {
    expect(getScheduleFor('이현지').some((i) => i.gameIdx === 1)).toBe(false)
  })
})

describe('getWarningsFor', () => {
  it('게임 배정 인원 부족 경고가 배정자에게 붙는다 (이강서·색깔 판 보조)', () => {
    expect(getWarningsFor('이강서').some((w) => w.includes('보조 4명'))).toBe(true)
  })

  it('WARN4 업무 겹침이 해당자에게 붙는다 (유주영·촬영)', () => {
    expect(getWarningsFor('유주영').some((w) => w.includes('촬영'))).toBe(true)
  })

  it('해당 없는 사람은 빈 배열이다 (이도연)', () => {
    expect(getWarningsFor('이도연')).toEqual([])
  })
})

describe('getProfile', () => {
  it('박서윤 — 명륜 파트와 팀장 배지를 함께 갖는다', () => {
    const labels = getProfile('박서윤').badges.map((b) => b.label)
    expect(labels).toContain('명륜 파트')
    expect(labels).toContain('팀장')
  })

  it('고연준 — 점수 집계 배지', () => {
    expect(getProfile('고연준').badges.map((b) => b.label)).toContain('점수 집계')
  })

  it('배지 없는 사람도 빈 배열로 반환된다 (신지나)', () => {
    expect(getProfile('신지나').badges).toEqual([])
  })

  it('모든 배지에 설명 문구가 있다', () => {
    for (const name of ROSTER_NAMES) {
      for (const b of getProfile(name).badges) {
        expect(b.desc.length, name).toBeGreaterThan(0)
      }
    }
  })
})
