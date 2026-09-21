/**
 * 소관 정합성 검증 스크립트
 *
 * 마스터 지침의 소관 매핑을 읽어, 회의/사전공유/안건서 문서에서
 * 외부 컨택 키워드(국제처 등)가 특정 팀에 월권 할당되는지 검증한다.
 *
 * 실행: npx tsx scripts/verify-scope-ownership.ts
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, relative } from 'path'
import {
  extractMappingYaml,
  parseMapping,
  checkDoc,
  type Violation,
} from './lib/scope-mapping'

const HUB_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(HUB_ROOT, '..')
const DOC_ROOT = resolve(REPO_ROOT, '26-2 Sports Day')

function walkMd(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...walkMd(full))
    } else if (entry.endsWith('.md')) {
      out.push(full)
    }
  }
  return out
}

function main() {
  // 1. 마스터에서 매핑 로드
  const masterPath = resolve(DOC_ROOT, '00_기획지침_마스터.md')
  const masterMd = readFileSync(masterPath, 'utf-8')
  const yamlText = extractMappingYaml(masterMd)
  if (!yamlText) {
    console.error('❌ 마스터 지침에서 소관 매핑 블록을 찾을 수 없습니다.')
    process.exit(1)
  }
  const mapping = parseMapping(yamlText)

  console.log('소관 정합성 검증 시작...\n')
  console.log(
    `매핑 로드: 팀 ${Object.keys(mapping.teams).length}개 / 외부 키워드 ${mapping.external.length}개\n`
  )

  // 2. 대상 문서 스캔
  const docs = walkMd(DOC_ROOT)
  let totalViolations = 0

  for (const absPath of docs) {
    const relPath = relative(REPO_ROOT, absPath).replace(/\\/g, '/')
    const md = readFileSync(absPath, 'utf-8')
    const violations: Violation[] = checkDoc(relPath, md, mapping)
    if (violations.length > 0) {
      for (const v of violations) {
        console.log(`❌ 월권 의심: ${v.file}:${v.line}`)
        console.log(`   ${v.detail}`)
        totalViolations++
      }
    }
  }

  console.log('')
  if (totalViolations === 0) {
    console.log(
      '✅ 소관 정합성 이상 없음 — 외부 컨택 키워드가 팀 문서에 월권 할당되지 않았습니다.'
    )
    process.exit(0)
  } else {
    console.log(
      `${totalViolations}건의 월권 의심 발견. 해당 팀 소관인지 매핑과 대조하세요.`
    )
    process.exit(1)
  }
}

main()
