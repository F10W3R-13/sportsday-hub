/**
 * 마크다운 → SQL 시드 변환 스크립트
 *
 * content-source/*.md 를 읽어 Task 4 파서 함수들로 파싱한 뒤
 * supabase/migrations/0005_seed_data.sql 시드 파일을 생성한다.
 *
 * 실행: npm run migrate:md  (tsx 필요)
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import {
  parseDecisions,
  parseMilestones,
  parseIssues,
  parseTeamChecklists,
  parseGuidelineSections,
} from '@/lib/markdown/parser'
import type { TeamId } from '@/lib/types/models'

// tsx/ESM 환경에서 __dirname 대체
const ROOT = resolve(__dirname, '..')

// ===== 팀 메타데이터 (고정) =====
const TEAM_META: Record<
  TeamId,
  { name: string; name_en: string; color: string; icon: string; mission: string }
> = {
  management: {
    name: '기획관리팀',
    name_en: 'Management',
    color: '#6366f1', // indigo
    icon: 'Settings',
    mission: '전체 총괄, 진행상황 업데이트, 팀 간 조율',
  },
  content: {
    name: '컨텐츠팀',
    name_en: 'Content',
    color: '#ec4899', // pink
    icon: 'Gamepad2',
    mission: '게임 구성·규칙, 배치도, 필요 인원/물품',
  },
  budget: {
    name: '예산팀',
    name_en: 'Budget',
    color: '#10b981', // emerald
    icon: 'Wallet',
    mission: '예산안, 입장료, 식사, 단체티, 준비물 리스트',
  },
  exchange: {
    name: '교환담당팀',
    name_en: 'Exchange',
    color: '#f59e0b', // amber
    icon: 'Users',
    mission: '구글폼, 참여자 명단, 교환 팀 배정, 카드뉴스 인계물',
  },
  timeline: {
    name: '타임라인/인원관리팀',
    name_en: 'Timeline',
    color: '#06b6d4', // cyan
    icon: 'CalendarClock',
    mission: '전체 타임라인, 하클 인원 배치, 명륜 버스 운영',
  },
}

const TEAM_ORDER: TeamId[] = [
  'management',
  'content',
  'budget',
  'exchange',
  'timeline',
]

// ===== SQL 이스케이프 헬퍼 =====
function sqlStr(s: string | null | undefined): string {
  if (s == null) return 'NULL'
  return `'${s.replace(/'/g, "''")}'`
}

function sqlBool(b: boolean): string {
  return b ? 'true' : 'false'
}

function sqlArray(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return 'NULL'
  return `ARRAY[${arr.map((s) => sqlStr(s)).join(',')}]::text[]`
}

function sqlJson(obj: unknown): string {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`
}

function sqlDate(d: string | null | undefined): string {
  if (!d) return 'NULL'
  return `'${d}'::date`
}

// ===== 시드 SQL 생성 메인 로직 =====
function generateSeed(): string {
  const srcDir = resolve(ROOT, 'content-source')
  const masterMd = readFileSync(
    join(srcDir, '00_기획지침_마스터.md'),
    'utf-8'
  )

  const lines: string[] = [
    '-- 26-2 스포츠데이 허브 시드 데이터',
    '-- 자동 생성: scripts/migrate-from-md.ts',
    '-- 재실행 가능 (idempotent): ON CONFLICT DO NOTHING/UPDATE',
    '',
    'BEGIN;',
    '',
  ]

  // ===== teams =====
  lines.push('-- ===== teams =====')
  for (let i = 0; i < TEAM_ORDER.length; i++) {
    const teamId = TEAM_ORDER[i]
    const meta = TEAM_META[teamId]
    const teamMdPath =
      teamId === 'management'
        ? join(srcDir, '00_기획지침_마스터.md')
        : join(srcDir, 'teams', `${teamId}.md`)
    const teamMd = readFileSync(teamMdPath, 'utf-8')
    const sections = parseGuidelineSections(teamMd)

    lines.push(
      `INSERT INTO public.teams (id, name, name_en, color, icon, sort_order, mission, guideline_doc) VALUES (${sqlStr(teamId)}, ${sqlStr(meta.name)}, ${sqlStr(meta.name_en)}, ${sqlStr(meta.color)}, ${sqlStr(meta.icon)}, ${i}, ${sqlStr(meta.mission)}, ${sqlJson({ sections })}) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en, color=EXCLUDED.color, icon=EXCLUDED.icon, mission=EXCLUDED.mission, guideline_doc=EXCLUDED.guideline_doc;`
    )
  }
  lines.push('')

  // ===== decisions (마스터에서) =====
  lines.push('-- ===== decisions =====')
  const decisions = parseDecisions(masterMd)
  for (const d of decisions) {
    lines.push(
      `INSERT INTO public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes) VALUES (${sqlStr(d.id)}, ${sqlStr(d.title)}, ${sqlArray(d.options)}, ${sqlStr(d.status)}, ${sqlStr(d.current_value)}, ${sqlDate(d.decision_date)}, ${d.sort_order}, ${sqlStr(d.notes)}) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, options=EXCLUDED.options, status=EXCLUDED.status, current_value=EXCLUDED.current_value, decision_date=EXCLUDED.decision_date, notes=EXCLUDED.notes;`
    )
  }
  lines.push('')

  // ===== milestones (마스터에서) =====
  lines.push('-- ===== milestones =====')
  const milestones = parseMilestones(masterMd)
  // 기존 데이터 정리 (재실행 시 중복 방지) — uuid 라 새로 생기므로 전체 삭제 후 재삽입
  lines.push('DELETE FROM public.milestones;')
  for (const m of milestones) {
    lines.push(
      `INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES (${sqlStr(m.id)}, ${sqlDate(m.date)}, ${sqlStr(m.title)}, ${sqlStr(m.team_id)}, ${sqlStr(m.category)}, ${sqlBool(m.completed)}, ${m.depends_on ? sqlArray(m.depends_on) : 'NULL'}, ${m.sort_order});`
    )
  }
  lines.push('')

  // ===== checklist_items (각 팀에서) =====
  lines.push('-- ===== checklist_items =====')
  lines.push('DELETE FROM public.checklist_items;')
  for (const teamId of TEAM_ORDER) {
    if (teamId === 'management') continue // 관리팀은 마스터에 체크리스트 없음
    const teamMdPath = join(srcDir, 'teams', `${teamId}.md`)
    const teamMd = readFileSync(teamMdPath, 'utf-8')
    const items = parseTeamChecklists(teamMd, teamId)
    for (const item of items) {
      lines.push(
        `INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES (${sqlStr(item.id)}, ${sqlStr(item.team_id)}, ${sqlStr(item.section)}, ${sqlStr(item.content)}, ${sqlStr(item.priority)}, ${sqlBool(item.completed)}, ${sqlStr(item.source)}, ${item.sort_order});`
      )
    }
  }
  lines.push('')

  // ===== issues (마스터 + 각 팀) =====
  lines.push('-- ===== issues =====')
  lines.push('DELETE FROM public.issues;')
  const masterIssues = parseIssues(masterMd, null)
  for (const issue of masterIssues) {
    lines.push(
      `INSERT INTO public.issues (id, team_id, date, title, status, notes) VALUES (${sqlStr(issue.id)}, NULL, ${sqlDate(issue.date)}, ${sqlStr(issue.title)}, ${sqlStr(issue.status)}, ${sqlStr(issue.notes)});`
    )
  }
  for (const teamId of TEAM_ORDER) {
    if (teamId === 'management') continue
    const teamMdPath = join(srcDir, 'teams', `${teamId}.md`)
    const teamMd = readFileSync(teamMdPath, 'utf-8')
    const issues = parseIssues(teamMd, teamId)
    for (const issue of issues) {
      lines.push(
        `INSERT INTO public.issues (id, team_id, date, title, status, notes) VALUES (${sqlStr(issue.id)}, ${sqlStr(issue.team_id)}, ${sqlDate(issue.date)}, ${sqlStr(issue.title)}, ${sqlStr(issue.status)}, ${sqlStr(issue.notes)});`
      )
    }
  }
  lines.push('')

  lines.push('COMMIT;')
  return lines.join('\n')
}

// ===== 메인 실행부 + 결과 리포트 =====
function main() {
  console.log('마크다운 → SQL 시드 변환 시작...\n')

  const sql = generateSeed()
  const outPath = resolve(ROOT, 'supabase/migrations/0005_seed_data.sql')
  writeFileSync(outPath, sql, 'utf-8')

  // 결과 리포트
  const srcDir = resolve(ROOT, 'content-source')
  const masterMd = readFileSync(
    join(srcDir, '00_기획지침_마스터.md'),
    'utf-8'
  )
  const decisions = parseDecisions(masterMd)
  const milestones = parseMilestones(masterMd)
  const masterIssues = parseIssues(masterMd, null)

  let totalChecklist = 0
  let totalTeamIssues = 0
  for (const teamId of TEAM_ORDER) {
    if (teamId === 'management') continue
    const teamMd = readFileSync(
      join(srcDir, 'teams', `${teamId}.md`),
      'utf-8'
    )
    totalChecklist += parseTeamChecklists(teamMd, teamId).length
    totalTeamIssues += parseIssues(teamMd, teamId).length
  }

  console.log('=== 이주 결과 리포트 ===')
  console.log(`teams:           ${TEAM_ORDER.length}`)
  console.log(`decisions:       ${decisions.length}`)
  console.log(`milestones:      ${milestones.length}`)
  console.log(`checklist_items: ${totalChecklist}`)
  console.log(
    `issues:          ${masterIssues.length + totalTeamIssues} (마스터 ${masterIssues.length} + 팀 ${totalTeamIssues})`
  )
  console.log(`\n출력: ${outPath}`)
}

main()
