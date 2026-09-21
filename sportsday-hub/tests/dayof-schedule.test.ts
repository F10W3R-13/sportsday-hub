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

// getScheduleFor는 이름 하나를 넣으면 당일 시간순 배치 전체를 돌려주는 순수 함수다.
// 아래는 템플릿 더미 데이터(12명·게임 2종) 기준의 엔진 동작 검증 —
// lead 확장·경계 매칭·중복 제거 규칙이 무너지면 여기서 깨진다.
// 데이터를 교체한 뒤에도 "구조" 검증(전원 커버리지·정렬·공통 항목)은 그대로 통과해야 한다.

describe('listNames', () => {
  it('전체 명단을 가나다순으로 반환한다', () => {
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

  it('게임 주심 — 역할과 judge 세부 설명이 붙는다 (강도윤·게임 A)', () => {
    const items = getScheduleFor('강도윤')
    const g = items.find((i) => i.gameIdx === 1)
    expect(g?.role).toBe('주심')
    expect(g?.title).toContain('게임 A')
    expect(g?.detail).toContain('반칙')
    // 오후 자유 텍스트의 동일 배정("게임 A 13:30~14:10 — 주심 강도윤")은 중복 제거
    expect(items.some((i) => i.title.includes('게임 A 13:30'))).toBe(false)
  })

  it('오후 자유 텍스트 — 상시 행이 담당 세그먼트로 분할된다 (임하은·도장/뽑기)', () => {
    expect(getScheduleFor('임하은').some((i) => i.title.includes('도장/뽑기'))).toBe(true)
  })

  it('플로우와 상시 배정이 함께 잡힌다 (한지민·출석 체크 + 점수 집계)', () => {
    const items = getScheduleFor('한지민')
    expect(items.some((i) => i.source === 'flow' && i.title.includes('출석 체크'))).toBe(true)
    expect(items.some((i) => i.title.includes('점수 집계'))).toBe(true)
  })

  it('"박민수 외 팀장" — 팀장 전원이 팀별 소집 항목을 받는다', () => {
    for (const lead of TEAMLEADS) {
      expect(
        getScheduleFor(lead).some((i) => i.title.includes('팀별 소집')),
        lead
      ).toBe(true)
    }
  })

  it('오후 "팀별 인솔 — 팀장" — 실명 없는 집합 표기도 팀장 전원에게 배정된다', () => {
    for (const lead of TEAMLEADS) {
      expect(
        getScheduleFor(lead).some((i) => i.title.includes('팀별 인솔')),
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

  it('아침 집합 — GATHER 명단 항목이 있고 슬롯보다 빠르지 않게 정렬된다 (윤서준)', () => {
    const items = getScheduleFor('윤서준')
    const gather = items.find((i) => i.source === 'gather')
    expect(gather?.title).toContain('출석 체크')
    expect(gather?.time).toBe('09:30~10:00')
    // 09:20 슬롯(집합 출석 체크)이 더 빠르므로 맨 앞은 슬롯 — 정렬 불변식은 오름차순 테스트가 담당
    expect(items[0].source).toBe('slot')
    expect(items[0].time).toBe('09:20~09:30')
  })

  it('오후 행의 명시적 시각이 항목 시각·정렬에 쓰인다 (한지민·중간 점검)', () => {
    const item = getScheduleFor('한지민').find((i) => i.title.includes('점수 중간점검'))
    expect(item?.time).toBe('15:10~15:45')
    expect(item?.sortKey).toBe(15 * 60 + 10)
    expect(item?.endSortKey).toBe(15 * 60 + 45)
  })

  it('슬롯 항목에 배치 총원이 붙는다 (강도윤·물품 이동 3명)', () => {
    const item = getScheduleFor('강도윤').find((i) => i.title === '물품 이동')
    expect(item?.headcount).toBe(3)
  })

  it('멤버 배치 — 조장이 아녀도 명단 전원에게 배정된다 (한지민·대기존 설치)', () => {
    expect(getScheduleFor('한지민').some((i) => i.title.includes('대기존 설치'))).toBe(true)
  })

  it('게임 항목에 같은 역할 동료 명단이 붙는다 (임하은·게임 A 게임 보조)', () => {
    const item = getScheduleFor('임하은').find((i) => i.gameIdx === 1 && i.role === '게임 보조')
    expect(item?.peers).toContain('최지우')
  })

  it('플로우 항목에 함께 하는 명단이 붙는다 (한지민·출석 체크)', () => {
    const item = getScheduleFor('한지민').find(
      (i) => i.source === 'flow' && i.title.includes('출석 체크')
    )
    expect(item?.peers).toContain('남주혁')
  })

  it('오후 항목의 detail에는 행 전체 원문이 남는다 (임하은·상시 도장/뽑기)', () => {
    const item = getScheduleFor('임하은').find((i) => i.title.includes('도장/뽑기'))
    expect(item?.detail).toContain('상시')
  })
})

describe('getWarningsFor', () => {
  it('게임 warn이 배정자에게 붙는다 (임하은·게임 A 보조 부족)', () => {
    expect(getWarningsFor('임하은').some((w) => w.includes('보조 4명'))).toBe(true)
  })

  it('WARN4 업무 겹침이 해당자에게 붙는다 (이영희·촬영)', () => {
    expect(getWarningsFor('이영희').some((w) => w.includes('촬영'))).toBe(true)
  })

  it('해당 없는 사람은 빈 배열이다 (김철수)', () => {
    expect(getWarningsFor('김철수')).toEqual([])
  })
})

describe('getProfile', () => {
  it('윤서준 — 캠퍼스A 파트와 지원 배지를 함께 갖는다', () => {
    const labels = getProfile('윤서준').badges.map((b) => b.label)
    expect(labels).toContain('명륜 파트')
    expect(labels).toContain('메이플 지원')
  })

  it('한지민 — 점수 집계 배지', () => {
    expect(getProfile('한지민').badges.map((b) => b.label)).toContain('점수 집계')
  })

  it('배지 없는 사람도 빈 배열로 반환된다 (조현우)', () => {
    expect(getProfile('조현우').badges).toEqual([])
  })

  it('모든 배지에 설명 문구가 있다', () => {
    for (const name of ROSTER_NAMES) {
      for (const b of getProfile(name).badges) {
        expect(b.desc.length, name).toBeGreaterThan(0)
      }
    }
  })
})

describe('cleanTitle', () => {
  it('모든 사람 이름(동료 포함)과 인라인 시각을 지운다', () => {
    expect(cleanTitle('게임 A 14:10~14:50 — 주심 강도윤')).toBe('게임 A — 주심')
    expect(cleanTitle('점수 집계 한지민')).toBe('점수 집계')
    expect(cleanTitle('상시 — 점수 집계(노트북) 한지민·남주혁')).toBe('상시 — 점수 집계(노트북)')
    expect(cleanTitle('부스 노래(BGM) 이영희')).toBe('부스 노래(BGM)')
  })

  it('"그 외:" 꼬리(내 담당 아닌 안내)는 제거한다', () => {
    expect(cleanTitle('국민체조 시범 ×5 오세훈·조현우 — 그 외: 본부 제외 본인 팀과 참여')).toBe(
      '국민체조 시범 ×5'
    )
  })

  it('이름이 없으면 시각만 지운다', () => {
    expect(cleanTitle('그 외 전원 — 본인 팀 천막 대기')).toBe('그 외 전원 — 본인 팀 천막 대기')
  })

  it('이름 없는 제목의 정당한 " · " 구분자는 유지한다', () => {
    expect(cleanTitle('대여물품 수령 · 출석 체크')).toBe('대여물품 수령 · 출석 체크')
    expect(cleanTitle('팀별 소집 — 팀장 3 · 부팀장 3')).toBe('팀별 소집 — 팀장 3 · 부팀장 3')
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
