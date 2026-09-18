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

  it('오후 "팀별 인솔 — 팀장 6" — 실명 없는 집합 표기도 팀장 전원에게 배정된다', () => {
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

  it('아침 집합 — GATHER 명단 항목이 시간순 맨 앞에 온다 (유주영·물품 상차, 시트2 기준)', () => {
    const items = getScheduleFor('유주영')
    expect(items[0].source).toBe('gather')
    expect(items[0].title).toContain('물품 상차')
    expect(items[0].time).toBe('09:30~10:00')
  })

  it('시트2 대조 — 이강서는 명륜 집합/버스 인솔에 없다 (배정 수정 반영)', () => {
    const items = getScheduleFor('이강서')
    expect(items.some((i) => i.title.includes('물품 상차'))).toBe(false)
    expect(items.some((i) => i.source === 'flow' && i.title.includes('버스 도착'))).toBe(false)
    expect(getScheduleFor('유주영').some((i) => i.source === 'flow' && i.title.includes('버스 도착'))).toBe(true)
  })

  it('09:20/09:50 하클 출석 체크 — 김소라·이주환의 첫 일정이 된다', () => {
    expect(getScheduleFor('김소라')[0].title).toContain('하클 출석 체크')
    expect(getScheduleFor('김소라')[0].time).toBe('09:20~09:30')
    expect(getScheduleFor('이주환').some((i) => i.time === '09:50~10:00')).toBe(true)
  })

  it('멤버 배치 — 조장이 아녀도 시트 명단 전원에게 배정된다 (전창민·총학 물품 이동)', () => {
    expect(getScheduleFor('전창민').some((i) => i.title === '총학 물품 이동')).toBe(true)
    expect(getScheduleFor('이나원').some((i) => i.title.includes('점심 수령'))).toBe(true)
  })

  it('멤버 배치 — 함께 담당 명단(peers)이 붙는다', () => {
    const item = getScheduleFor('전창민').find((i) => i.title === '총학 물품 이동')
    expect(item?.peers).toContain('성현중')
    expect(item?.peers).toContain('박하늘')
  })

  it('촬영 담당 — 유주영·최준혁에게 12:00~18:10 독립 일정이 있다', () => {
    for (const n of ['유주영', '최준혁']) {
      const item = getScheduleFor(n).find((i) => i.title.includes('행사 촬영'))
      expect(item, n).toBeDefined()
      expect(item?.time).toBe('12:00~18:10')
    }
  })

  it('2부 도장/뽑기 — 박서원·안령인은 없고 메이플 지원(강지예)이 담당한다', () => {
    expect(getScheduleFor('박서원').some((i) => i.title.includes('도장/뽑기'))).toBe(false)
    expect(getScheduleFor('안령인').some((i) => i.title.includes('도장/뽑기'))).toBe(false)
    expect(getScheduleFor('강지예').some((i) => i.title.includes('도장/뽑기'))).toBe(true)
  })

  it('팀별 소집 — 부팀장 6명도 받는다 (members 기준 12명)', () => {
    for (const v of ['이희수', '전창민', '서인호', '이현지', '최준혁', '예건희']) {
      expect(getScheduleFor(v).some((i) => i.title.includes('팀별 소집')), v).toBe(true)
    }
  })

  it('계주 게임 보조 — 이현지·이은재가 추가됐다', () => {
    for (const n of ['이현지', '이은재']) {
      const item = getScheduleFor(n).find((i) => i.gameIdx === 6)
      expect(item?.role, n).toBe('게임 보조')
    }
  })

  it('메이플 지원 — 6명 전원이 짝 찾기 보조를 받는다', () => {
    for (const n of ['강지예', '김연수', '뭉흐솝드', '이소윤', '이용재', '임준성']) {
      expect(getScheduleFor(n).some((i) => i.gameIdx === 3), n).toBe(true)
    }
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
  it('모든 사람 이름(동료 포함)과 인라인 시각을 지운다', () => {
    expect(cleanTitle('짝 찾기 (메인) 14:50~15:10 — 리드 강단비')).toBe('짝 찾기 (메인) — 리드')
    expect(cleanTitle('생존집계 이현서')).toBe('생존집계')
    expect(cleanTitle('상시 — 점수 집계(노트북) 고연준·이주환')).toBe('상시 — 점수 집계(노트북)')
    expect(cleanTitle('부스 노래(BGM) 김나경')).toBe('부스 노래(BGM)')
  })

  it('"그 외:" 꼬리(내 담당 아닌 안내)는 제거한다', () => {
    expect(
      cleanTitle('국민체조 시범 ×5 이대현·전창민·박하늘·이강서·윤시현 — 그 외: 본부 제외 본인 팀과 참여')
    ).toBe('국민체조 시범 ×5')
  })

  it('이름이 없으면 시각만 지운다', () => {
    expect(cleanTitle('그 외 전원 — 본인 팀 천막 대기')).toBe('그 외 전원 — 본인 팀 천막 대기')
  })

  it('이름 없는 제목의 정당한 " · " 구분자는 유지한다', () => {
    expect(cleanTitle('대여물품 수령 · 출석 체크')).toBe('대여물품 수령 · 출석 체크')
    expect(cleanTitle('팀별 소집 — 팀장 6 · 부팀장 6')).toBe('팀별 소집 — 팀장 6 · 부팀장 6')
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
