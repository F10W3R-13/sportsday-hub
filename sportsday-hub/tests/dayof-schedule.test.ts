import { describe, it, expect } from 'vitest'
import {
  listNames,
  getProfile,
  getScheduleFor,
  getWarningsFor,
  cleanTitle,
  phaseFor,
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

// ── v2: 정보 최대화·시각 정밀화 (대형 제목 UI의 데이터 기반) ──

describe('dayof/schedule 시각 정밀화', () => {
  it('오후 행의 명시적 시각이 항목 시각·정렬에 쓰인다 (강단비·짝 찾기 리드)', () => {
    const item = getScheduleFor('강단비').find((i) => i.title.includes('리드 강단비'))
    expect(item?.time).toBe('14:50~15:10')
    expect(item?.sortKey).toBe(14 * 60 + 50)
    expect(item?.endSortKey).toBe(15 * 60 + 10)
  })

  it('행 선두의 시각(중간 점검 15:10~15:45)이 뒤 세그먼트 담당자에게도 적용된다 (김지원)', () => {
    const item = getScheduleFor('김지원').find((i) => i.title.includes('중간 발표'))
    expect(item?.sortKey).toBe(15 * 60 + 10)
  })

  it('슬롯 항목에 배치 총원이 붙는다 (성현중·총학 물품 이동 11명)', () => {
    const item = getScheduleFor('성현중').find((i) => i.title === '총학 물품 이동')
    expect(item?.headcount).toBe(11)
  })

  it('게임 항목에 같은 역할 동료 명단이 붙는다 (짝 찾기·심판 4)', () => {
    const item = getScheduleFor('강단비').find((i) => i.gameIdx === 3)
    expect(item?.peers).toContain('성현중')
  })

  it('플로우 항목에 함께 하는 명단이 붙는다 (고연준·출석 체크)', () => {
    const item = getScheduleFor('고연준').find(
      (i) => i.source === 'flow' && i.title.includes('출석 체크')
    )
    expect(item?.peers).toContain('성현중')
  })

  it('오후 항목의 detail에는 행 전체 원문이 남는다 (이현지·상시 도장/뽑기)', () => {
    const item = getScheduleFor('이현지').find((i) => i.title.includes('도장/뽑기/간식'))
    expect(item?.detail).toContain('상시')
    expect(item?.detail).toContain('페이스페인팅')
  })
})

describe('cleanTitle', () => {
  it('내 이름과 인라인 시각을 지우고 띄어쓰기를 정리한다', () => {
    expect(cleanTitle('짝 찾기 (메인) 14:50~15:10 — 리드 강단비', '강단비')).toBe(
      '짝 찾기 (메인) — 리드'
    )
    expect(cleanTitle('생존집계 이현서', '이현서')).toBe('생존집계')
    expect(cleanTitle('상시 — 점수 집계(노트북) 고연준·이주환', '고연준')).toBe(
      '상시 — 점수 집계(노트북) 이주환'
    )
    expect(cleanTitle('15:10~15:45 중간 — 중간 발표(사회) 김지원·김소라', '김지원')).toBe(
      '중간 — 중간 발표(사회) 김소라'
    )
  })

  it('이름이 없으면 시각만 지운다', () => {
    expect(cleanTitle('그 외 전원 — 본인 팀 천막 대기', '고연준')).toBe(
      '그 외 전원 — 본인 팀 천막 대기'
    )
  })
})

describe('phaseFor', () => {
  const base = { time: '09:30~10:00', sortKey: 570, title: 'x', source: 'slot' as const, endSortKey: 600 }

  it('진행 중 / 지남 / 예정을 판정한다', () => {
    expect(phaseFor(base, 580)).toBe('current')
    expect(phaseFor(base, 610)).toBe('past')
    expect(phaseFor(base, 500)).toBe('future')
  })

  it('종료 시각이 없으면 시작+30분 기준으로 판정한다', () => {
    const item = { ...base, endSortKey: undefined }
    expect(phaseFor(item, 570 + 29)).toBe('current')
    expect(phaseFor(item, 570 + 31)).toBe('past')
  })
})
