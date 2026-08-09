/**
 * 지침(guideline_doc) 전용 갱신 스크립트
 *
 * content-source/*.md 에서 guideline 섹션만 파싱해 teams.guideline_doc 컬럼을 UPDATE 한다.
 * decisions / milestones / checklist_items / issues 테이블은 일절 건드리지 않는다.
 * (마일스톤·체크리스트 등 동적 데이터는 웹앱 UI가 SSOT — 보존 필수)
 *
 * 실행: npx tsx scripts/update-guideline-doc.ts [--dry-run]
 *   --dry-run: DB 쓰지 않고 파싱 결과만 출력
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, join } from 'path'
import { parseGuidelineSections } from '@/lib/markdown/parser'
import type { TeamId } from '@/lib/types/models'

const ROOT = resolve(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

// 팀 ID → content-source 파일 경로 매핑 (migrate-from-md.ts 와 동일)
const TEAM_FILES: Record<TeamId, string> = {
  management: '00_기획지침_마스터.md',
  content: 'teams/content.md',
  budget: 'teams/budget.md',
  exchange: 'teams/exchange.md',
  timeline: 'teams/timeline.md',
}

const TEAM_IDS: TeamId[] = [
  'management',
  'content',
  'budget',
  'exchange',
  'timeline',
]

function loadEnv() {
  const envPath = resolve(ROOT, '.env.local')
  const env = readFileSync(envPath, 'utf-8')
  const get = (k: string) =>
    env.match(new RegExp(`${k}=(.+)`))?.[1]?.trim()
  const url = get('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!url || !anonKey) {
    throw new Error('.env.local 에 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 가 없습니다')
  }
  return { url, anonKey }
}

async function main() {
  const srcDir = resolve(ROOT, 'content-source')
  console.log('=== 지침(guideline_doc) 갱신 시작 ===\n')

  // 1. 각 팀 마크다운 파싱
  const updates: Array<{ teamId: TeamId; sections: ReturnType<typeof parseGuidelineSections> }> = []
  for (const teamId of TEAM_IDS) {
    const mdPath = join(srcDir, TEAM_FILES[teamId])
    const md = readFileSync(mdPath, 'utf-8')
    const sections = parseGuidelineSections(md)
    updates.push({ teamId, sections })
    console.log(`${teamId}: ${sections.length}개 섹션 파싱`)
    for (const s of sections) {
      console.log(`  [${s.order}] ${s.title}`)
    }
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] DB 갱신 생략 — 파싱 결과만 출력')
    return
  }

  // 2. DB 갱신 (teams.guideline_doc 만)
  const { url, anonKey } = loadEnv()
  const supabase = createClient(url, anonKey)

  console.log('\n=== DB 갱신 (teams.guideline_doc) ===')
  let ok = 0
  let fail = 0
  for (const { teamId, sections } of updates) {
    const guidelineDoc = { sections }
    const { error } = await supabase
      .from('teams')
      .update({ guideline_doc: guidelineDoc })
      .eq('id', teamId)
    if (error) {
      console.log(`❌ ${teamId}: ${error.message}`)
      fail++
    } else {
      console.log(`✅ ${teamId}: 갱신 완료 (${sections.length} 섹션)`)
      ok++
    }
  }

  console.log(`\n완료: ${ok} 성공, ${fail} 실패`)

  // 3. 다른 테이블이 건드려지지 않았음을 명시
  console.log('\n※ decisions / milestones / checklist_items / issues 테이블은 건드리지 않음 (보존)')
}

main().catch((e) => {
  console.error('에러:', e)
  process.exit(1)
})
