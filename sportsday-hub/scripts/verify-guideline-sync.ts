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

// canonical(사람이 관리하는 원본 문서 폴더) — 실행 시 --canonical=<경로> 로 지정.
// 미지정 시 26-2 아카이브(참고용)를 기본으로 둔다.
// 예) npx tsx scripts/verify-guideline-sync.ts --canonical="../27-1 Sports Day"
const CANONICAL_ROOT =
  process.argv
    .find((a) => a.startsWith('--canonical='))
    ?.slice('--canonical='.length) ??
  resolve(REPO_ROOT, 'archive/2026-2/sports-day')

// canonical → content-source 매핑 (canonical 루트는 상단 CANONICAL_ROOT 참조)
const PAIRS: Array<{ name: string; canonical: string; source: string }> = [
  {
    name: '마스터',
    canonical: resolve(CANONICAL_ROOT, '00_기획지침_마스터.md'),
    source: resolve(HUB_ROOT, 'content-source/00_기획지침_마스터.md'),
  },
  {
    name: '컨텐츠팀',
    canonical: resolve(CANONICAL_ROOT, '컨텐츠팀/컨텐츠팀_지침.md'),
    source: resolve(HUB_ROOT, 'content-source/teams/content.md'),
  },
  {
    name: '예산팀',
    canonical: resolve(CANONICAL_ROOT, '예산팀/예산팀_지침.md'),
    source: resolve(HUB_ROOT, 'content-source/teams/budget.md'),
  },
  {
    name: '교환담당팀',
    canonical: resolve(CANONICAL_ROOT, '교환담당팀/교환담당팀_지침.md'),
    source: resolve(HUB_ROOT, 'content-source/teams/exchange.md'),
  },
  {
    name: '타임라인팀',
    canonical: resolve(
      CANONICAL_ROOT,
      '타임라인_인원관리팀/타임라인_인원관리팀_지침.md'
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
