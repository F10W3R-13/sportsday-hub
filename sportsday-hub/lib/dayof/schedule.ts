// lib/dayof/schedule.ts — 이름 하나로 당일 시간순 배치 전체를 뽑는 순수 함수군.
// 데이터는 lib/dayof/data.ts (roster.js 스냅샷). 파싱 규칙:
//  · 구조화 배치(MORNING/LUNCH·FLOW·GAMES·GATHER)는 필드 기반 매칭
//  · AFTERNOON 자유 텍스트는 ' · ' 세그먼트 분할 + 명단 사전 경계 매칭
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
  sortKey: number
  title: string
  role?: string
  detail?: string
  gameIdx?: number
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

function startMinutes(time: string): number {
  const m = /(\d{1,2}):(\d{2})/.exec(time)
  if (!m) throw new Error(`시각 파싱 실패: ${time}`)
  return Number(m[1]) * 60 + Number(m[2])
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
      for (const name of ROSTER_NAMES) {
        if (!mentions(row.n, name)) continue
        push(name, {
          time: row.t,
          sortKey: startMinutes(row.t),
          title: row.d,
          detail: group.title,
          source: 'gather',
        })
      }
    }
  }

  // 2. 오전·점심 배치 슬롯 (MORNING/LUNCH).
  for (const slot of [...MORNING, ...LUNCH]) {
    const key = startMinutes(slot.time)
    for (const row of slot.rows) {
      if (row.k === 'N') {
        if (row.text.includes('전원')) {
          pushAll({ time: slot.time, sortKey: key, title: row.text, source: 'common' })
          continue
        }
        for (const seg of row.text.split(' · ')) {
          for (const name of ROSTER_NAMES) {
            if (mentions(seg, name)) {
              push(name, { time: slot.time, sortKey: key, title: seg, source: 'slot' })
            }
          }
        }
        continue
      }
      const cells: SlotCell[] =
        row.k === 'H'
          ? [row.l, ...(row.r ? [row.r] : [])]
          : [{ role: row.role, n: row.n, lead: row.lead }]
      for (const cell of cells) {
        if (cell.lead) {
          for (const owner of leadOwners(cell.lead)) {
            push(owner, {
              time: slot.time,
              sortKey: key,
              title: cell.role,
              detail: slot.label,
              source: 'slot',
            })
          }
        } else {
          // lead 없는 셀(예: 12:50 팀별 부스 입장)은 전원 공통.
          pushAll({ time: slot.time, sortKey: key, title: cell.role, source: 'common' })
        }
      }
    }
  }

  // 3. 입장 수속 플로우 (FLOW) — 11:50 전원 수속.
  const flowKey = 11 * 60 + 50
  for (const step of FLOW) {
    for (const name of ROSTER_NAMES) {
      if (!mentions(step.n, name)) continue
      push(name, {
        time: '11:50 입장 수속',
        sortKey: flowKey,
        title: step.t,
        detail: step.d.replace(/\n/g, ' · '),
        source: 'flow',
      })
    }
  }

  // 4. 게임 배정 (GAMES) — "역할 — 이름들" 파싱 + judge 세부 설명 매핑.
  for (const game of GAMES) {
    const key = startMinutes(game.time)
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
          sortKey: key,
          title: game.name,
          role,
          detail: judges.length > 0 ? judges.join(' · ') : undefined,
          gameIdx: game.idx,
          source: 'game',
        })
      }
    }
  }

  // 5. 오후 자유 텍스트 (AFTERNOON).
  for (const slot of AFTERNOON) {
    const key = startMinutes(slot.time)
    for (const row of slot.rows) {
      if (row.includes('전원') || row.includes('다 같이')) {
        pushAll({ time: slot.time, sortKey: key, title: row, source: 'common' })
        continue
      }
      const alias = GAME_ALIASES.find(([, a]) => row.includes(a))
      for (const seg of row.split(' · ')) {
        for (const name of ROSTER_NAMES) {
          if (!mentions(seg, name)) continue
          if (alias) {
            const covered = map.get(name)?.find((i) => i.gameIdx === alias[0])
            // 게임 카드가 같은 역할까지 이미 커버하면 오후 중복 행은 버린다.
            if (covered?.role && seg.includes(covered.role)) continue
          }
          push(name, { time: slot.time, sortKey: key, title: seg, source: 'afternoon' })
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
