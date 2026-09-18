// lib/dayof/schedule.ts — 이름 하나로 당일 시간순 배치 전체를 뽑는 순수 함수군.
// 데이터는 lib/dayof/data.ts (roster.js 스냅샷). 파싱 규칙:
//  · 구조화 배치(MORNING/LUNCH·FLOW·GAMES·GATHER)는 필드 기반 매칭
//  · AFTERNOON 자유 텍스트는 ' · ' 세그먼트 분할 + 명단 사전 경계 매칭
//    · 행에 명시적 "HH:MM~HH:MM"이 있으면 그 시각이 항목 시각·정렬 기준이 된다
//  · "OO 외 팀장 6" lead는 팀장 전원으로 확장
//  · 전원 대상 행(전원/다 같이/lead 없는 셀)은 공통 항목으로 전배
//  · 오후 텍스트의 게임 배정은 게임 카드 항목과 역할이 같으면 중복 제거

import {
  AFTERNOON,
  FLOW,
  GAMES,
  GATHER,
  JUKSIK,
  LUNCH,
  MAPLE6,
  MC,
  MORNING,
  MR6,
  ROSTER_NAMES,
  TEAMLEADS,
  VICELEADS,
  WARN4,
  type SlotCell,
} from './data'

export type ScheduleSource = 'gather' | 'slot' | 'common' | 'flow' | 'game' | 'afternoon'

export interface ScheduleItem {
  time: string
  /** 시작 시각(분). 정렬 기준. */
  sortKey: number
  /** 종료 시각(분). 없으면 phaseFor가 시작+30분으로 판정. */
  endSortKey?: number
  title: string
  role?: string
  detail?: string
  gameIdx?: number
  /** 배치 총원(슬롯 항목). */
  headcount?: number
  /** 같은 일을 함께하는 명단 원문(게임 같은 역할·플로우 단계). */
  peers?: string
  source: ScheduleSource
}

export interface ProfileBadge {
  label: string
  desc: string
}

export interface PersonProfile {
  name: string
  badges: ProfileBadge[]
}

// 한글 경계 매칭 — "이현서"가 다른 이름의 일부로 오매칭되지 않게 한다.
function mentions(text: string, name: string): boolean {
  return new RegExp(`(?<![가-힣])${name}(?![가-힣])`).test(text)
}

/** "09:30~10:00"·"13:30 ~ 14:10"·"18:00~"(열린 끝)·단일 시각을 분 단위로. */
function parseRange(time: string): { start: number; end: number } {
  const m = /(\d{1,2}):(\d{2})(?:\s*~\s*(?:(\d{1,2}):(\d{2}))?)?/.exec(time)
  if (!m) throw new Error(`시각 파싱 실패: ${time}`)
  const start = Number(m[1]) * 60 + Number(m[2])
  if (m[4] !== undefined) return { start, end: Number(m[3]) * 60 + Number(m[4]) }
  if (m[0].includes('~')) return { start, end: 23 * 60 + 59 } // "18:00~" 같은 열린 구간
  return { start, end: start + 15 } // 단일 시각 = 15분 짜리로 취급
}

function startMinutes(time: string): number {
  return parseRange(time).start
}

// "배현빈 외 팀장 6" 같은 lead는 팀장 전원, 그 외는 lead 1인.
function leadOwners(lead: string): string[] {
  return lead.includes('외 팀장') ? TEAMLEADS : [lead]
}

// 오후 자유 텍스트에서 게임 행 식별용 별칭 (행 단위).
const GAME_ALIASES: [number, string][] = [
  [1, '색깔 판'],
  [2, '무궁화'],
  [3, '짝 찾기'],
  [4, '줄다리기'],
  [5, '피구'],
  [6, '계주'],
]

function buildSchedules(): Map<string, ScheduleItem[]> {
  const map = new Map<string, ScheduleItem[]>()
  const push = (name: string, item: ScheduleItem) => {
    const list = map.get(name) ?? []
    list.push(item)
    map.set(name, list)
  }
  const pushAll = (item: ScheduleItem) => {
    for (const name of ROSTER_NAMES) push(name, item)
  }

  // 1. 아침 집합 (GATHER) — 이름이 명시된 행만.
  for (const group of [GATHER.myeongryun, GATHER.yuljeon]) {
    for (const row of group.rows) {
      const { start, end } = parseRange(row.t)
      for (const name of ROSTER_NAMES) {
        if (!mentions(row.n, name)) continue
        push(name, {
          time: row.t,
          sortKey: start,
          endSortKey: end,
          title: row.d,
          detail: `${group.title} · ${group.chip}`,
          source: 'gather',
        })
      }
    }
  }

  // 2. 오전·점심 배치 슬롯 (MORNING/LUNCH).
  for (const slot of [...MORNING, ...LUNCH]) {
    const { start, end } = parseRange(slot.time)
    for (const row of slot.rows) {
      if (row.k === 'N') {
        if (row.text.includes('전원')) {
          pushAll({ time: slot.time, sortKey: start, endSortKey: end, title: row.text, source: 'common' })
          continue
        }
        for (const seg of row.text.split(' · ')) {
          for (const name of ROSTER_NAMES) {
            if (mentions(seg, name)) {
              push(name, { time: slot.time, sortKey: start, endSortKey: end, title: seg, source: 'slot' })
            }
          }
        }
        continue
      }
      const cells: SlotCell[] = row.k === 'H' ? [row.l, ...(row.r ? [row.r] : [])] : [row]
      for (const cell of cells) {
        // members(시트 전원 명단)가 있으면 전원에게 배정 — 조장만 추적하면
        // 오전 배치 대부분이 사라진다(2026-09-18 시트2 대조). 없으면 lead 규칙.
        const owners = cell.members ?? (cell.lead ? leadOwners(cell.lead) : [])
        if (owners.length > 0) {
          for (const owner of owners) {
            if (!ROSTER_NAMES.includes(owner)) continue
            push(owner, {
              time: slot.time,
              sortKey: start,
              endSortKey: end,
              title: cell.role,
              detail: slot.label,
              headcount: cell.n > 0 ? cell.n : undefined,
              peers:
                cell.members && cell.members.length > 1
                  ? cell.members.filter((m) => m !== owner).join(' · ')
                  : undefined,
              source: 'slot',
            })
          }
        } else {
          // lead 없는 셀(예: 12:50 팀별 부스 입장)은 전원 공통.
          pushAll({ time: slot.time, sortKey: start, endSortKey: end, title: cell.role, source: 'common' })
        }
      }
    }
  }

  // 3. 입장 수속 플로우 (FLOW) — 11:50 전원 수속, 각 단계 15분 가정.
  const flowKey = 11 * 60 + 50
  for (const step of FLOW) {
    for (const name of ROSTER_NAMES) {
      if (!mentions(step.n, name)) continue
      push(name, {
        time: '11:50 입장 수속',
        sortKey: flowKey,
        endSortKey: flowKey + 15,
        title: step.t,
        detail: step.d.replace(/\n/g, ' · '),
        peers: step.n,
        source: 'flow',
      })
    }
  }

  // 4. 게임 배정 (GAMES) — "역할 — 이름들" 파싱 + judge 세부 설명 매핑.
  for (const game of GAMES) {
    const { start, end } = parseRange(game.time)
    for (const entry of game.assign) {
      const [role, names] = entry.split(' — ')
      const judges = game.judge.filter((j) => {
        const prefix = j.split(':')[0]
        return role.includes(prefix) || prefix.includes(role)
      })
      for (const name of ROSTER_NAMES) {
        if (!mentions(names, name)) continue
        push(name, {
          time: game.time,
          sortKey: start,
          endSortKey: end,
          title: game.name,
          role,
          detail: judges.length > 0 ? judges.join(' · ') : undefined,
          gameIdx: game.idx,
          peers: names,
          source: 'game',
        })
      }
    }
  }

  // 5. 오후 자유 텍스트 (AFTERNOON) — 행에 명시적 시각이 있으면 그것을 쓴다.
  for (const slot of AFTERNOON) {
    for (const row of slot.rows) {
      if (row.includes('전원') || row.includes('다 같이')) {
        const { start, end } = parseRange(slot.time)
        pushAll({ time: slot.time, sortKey: start, endSortKey: end, title: row, source: 'common' })
        continue
      }
      const explicit = row.match(/(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})/)
      const timeLabel = explicit ? `${explicit[1]}~${explicit[2]}` : slot.time
      const { start, end } = parseRange(timeLabel)
      const alias = GAME_ALIASES.find(([, a]) => row.includes(a))
      for (const seg of row.split(' · ')) {
        // 오후 자유 텍스트의 집합 표기("팀장 6")는 실명이 없어 이름 매칭이 비므로
        // 직제 그룹으로 확장 배정한다 (슬롯의 "OO 외 팀장 6"과 같은 취급).
        const segHasName = ROSTER_NAMES.some((n) => mentions(seg, n))
        const segOwners = segHasName
          ? ROSTER_NAMES.filter((n) => mentions(seg, n))
          : seg.includes('부팀장')
            ? VICELEADS
            : seg.includes('팀장')
              ? TEAMLEADS
              : []
        for (const name of segOwners) {
          if (alias) {
            const covered = map.get(name)?.find((i) => i.gameIdx === alias[0])
            // 게임 카드가 같은 역할까지 이미 커버하면 오후 중복 행은 버린다.
            if (covered?.role && seg.includes(covered.role)) continue
          }
          push(name, {
            time: timeLabel,
            sortKey: start,
            endSortKey: end,
            title: seg,
            detail: row, // 드롭다운용 원문 전체
            source: 'afternoon',
          })
        }
      }
    }
  }

  for (const items of map.values()) items.sort((a, b) => a.sortKey - b.sortKey)
  return map
}

const SCHEDULES = buildSchedules()

function assertKnown(name: string) {
  if (!ROSTER_NAMES.includes(name)) throw new Error(`명단에 없는 이름: ${name}`)
}

export function listNames(): string[] {
  return ROSTER_NAMES
}

export function getScheduleFor(name: string): ScheduleItem[] {
  assertKnown(name)
  return [...(SCHEDULES.get(name) ?? [])]
}

export function getWarningsFor(name: string): string[] {
  assertKnown(name)
  const out = WARN4.filter((w) => mentions(w, name))
  for (const item of SCHEDULES.get(name) ?? []) {
    if (item.gameIdx === undefined) continue
    const warn = GAMES.find((g) => g.idx === item.gameIdx)?.warn
    if (warn) out.push(`${item.title} — ${warn}`)
  }
  return [...new Set(out)]
}

/** 대형 제목용 — 모든 사람 이름·인라인 시각·운영 잔여 문구를 지운다. */
export function cleanTitle(title: string): string {
  let out = title
  // 동료 이름도 제목에서 뺀다 — 함께하는 사람은 세부 드롭다운(원문·peers)에 있다.
  for (const n of ROSTER_NAMES) {
    out = out.replace(new RegExp(`(?<![가-힣])${n}(\\s*·\\s*)?`, 'g'), '')
  }
  return out
    .replace(/\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2}/g, '')
    .replace(/\s*—?\s*그 외:.*$/, '')
    .replace(/\s*·\s*$/g, '') // 이름이 빠지며 끝에 남는 구분자만 정리
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export type ItemPhase = 'past' | 'current' | 'future'

/** 당일 현시각(분) 기준 항목 상태. 종료 미정이면 시작+30분으로 판정. */
export function phaseFor(
  item: Pick<ScheduleItem, 'sortKey' | 'endSortKey'>,
  minutesOfDay: number
): ItemPhase {
  const end = item.endSortKey ?? item.sortKey + 30
  if (minutesOfDay < item.sortKey) return 'future'
  if (minutesOfDay < end) return 'current'
  return 'past'
}

const BADGE_DEFS: { names: string[]; label: string; desc: string }[] = [
  {
    names: TEAMLEADS,
    label: '팀장',
    desc: '팀 천막 안내(입장 수속 5단계) · 12:50 팀별 소집 · 교환 학생과 함께 천막 대기',
  },
  {
    names: VICELEADS,
    label: '부팀장',
    desc: '단체티 배부 — 도장판 기준, 사이즈 불일치 즉시 보고 (입장 수속 6단계)',
  },
  { names: MC, label: '사회', desc: '개회·중간·최종 발표 진행 (마이크)' },
  { names: JUKSIK, label: '점수 집계', desc: '본부 옆 상시 집계 — 경기 종료 후 각 게임 점수 전달' },
  { names: MAPLE6, label: '메이플 지원', desc: 'SG MAPLE 지원 — 본인 팀 게임이 없는 시간에 게임 보조·부스 지원 (시트 출석 표시는 미정)' },
  { names: MR6, label: '명륜 파트', desc: '09:30 명륜 국제관 L 집합 — 버스 탑승 안내 담당' },
]

export function getProfile(name: string): PersonProfile {
  assertKnown(name)
  return {
    name,
    badges: BADGE_DEFS.filter((d) => d.names.includes(name)).map(({ label, desc }) => ({
      label,
      desc,
    })),
  }
}

// startMinutes는 data 무결성 테스트 등 외부 사용 대비 유지.
export { startMinutes }
