/**
 * 지침 동기화 검증 스크립트
 *
 * canonical (26-2 Sports Day/) 와 content-source (sportsday-hub/content-source/)
 * 두 소스가 동일한지 확인한다. DB에 접근하지 않는다.
 *
 * 실행: npx tsx scripts/verify-guideline-sync.ts
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

const HUB_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(HUB_ROOT, '..')

// canonical → content-source 매핑
const PAIRS: Array<{ name: string; canonical: string; source: string }> = [
  {
    name: '마스터',
    canonical: resolve(REPO_ROOT, '26-2 Sports Day/00_기획지침_마스터.md'),
    source: resolve(HUB_ROOT, 'content-source/00_기획지침_마스터.md'),
  },
  {
    name: '컨텐츠팀',
    canonical: resolve(REPO_ROOT, '26-2 Sports Day/컨텐츠팀/컨텐츠팀_지침.md'),
    source: resolve(HUB_ROOT, 'content-source/teams/content.md'),
  },
  {
    name: '예산팀',
    canonical: resolve(REPO_ROOT, '26-2 Sports Day/예산팀/예산팀_지침.md'),
    source: resolve(HUB_ROOT, 'content-source/teams/budget.md'),
  },
  {
    name: '교환담당팀',
    canonical: resolve(
      REPO_ROOT,
      '26-2 Sports Day/교환담당팀/교환담당팀_지침.md'
    ),
    source: resolve(HUB_ROOT, 'content-source/teams/exchange.md'),
  },
  {
    name: '타임라인팀',
    canonical: resolve(
      REPO_ROOT,
      '26-2 Sports Day/타임라인_인원관리팀/타임라인_인원관리팀_지침.md'
    ),
    source: resolve(HUB_ROOT, 'content-source/teams/timeline.md'),
  },
]

function main() {
  let mismatch = 0

  console.log('지침 동기화 검증 시작...\n')
  for (const pair of PAIRS) {
    const canonical = readFileSync(pair.canonical, 'utf-8')
    const source = readFileSync(pair.source, 'utf-8')
    if (canonical === source) {
      console.log(`✅ ${pair.name}: 동기화됨`)
    } else {
      console.log(`❌ ${pair.name}: 불일치`)
      console.log(`   canonical: ${pair.canonical}`)
      console.log(`   source:    ${pair.source}`)
      mismatch++
    }
  }

  console.log('')
  if (mismatch === 0) {
    console.log('모든 지침이 동기화되어 있습니다.')
    process.exit(0)
  } else {
    console.log(`${mismatch}개 파일이 불일치합니다. content-source를 canonical에 맞춰 복사하세요.`)
    process.exit(1)
  }
}

main()
