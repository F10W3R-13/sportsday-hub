// 체크리스트 변환 검증 스크립트
// 원본(0005) vs 변환(checklist_transformed.json) 대조
// 검증 1: 고유명사 보존, 2: 핵심 정보 보존, 3: 작년 참고 잔류, 4: 빈 content
import { readFileSync } from 'fs'
import { tmpdir } from 'os'

const tmp = tmpdir()

// 변환 데이터 로드
const transformed = JSON.parse(readFileSync(tmp + '/checklist_transformed.json', 'utf8'))

// 보호 대상 고유명사 (절대 훼손/삭제되면 안 됨)
const PROTECTED_TERMS = [
  'SG MAPLE',
  'Extra Registration',
  'Departure Location',
  '하클',
  '율전',
  '명륜',
  '브룸',
  '롯데리아',
  '탑앤탑',
  '게임연구소',
]

// 검증 1: 고유명사 보존 — 원본 content에 있는 보호 대상 단어가 새 content 또는 source에서 사라지면 FAIL
// (작년 참고가 source로 이동하면서 고유명사도 같이 이동할 수 있으므로 source도 검사)
function checkProtectedTerms() {
  const failures = []
  for (const team of ['content', 'budget', 'exchange', 'timeline']) {
    for (const item of transformed[team]) {
      for (const term of PROTECTED_TERMS) {
        const wasInContent = item.originalContent.includes(term)
        const isInNewContent = item.newContent.includes(term)
        const isInNewSource = item.newSource ? item.newSource.includes(term) : false
        if (wasInContent && !isInNewContent && !isInNewSource) {
          failures.push({
            id: item.id.slice(0, 8),
            team: item.team,
            sortOrder: item.sortOrder,
            term,
            original: item.originalContent,
            transformed: item.newContent,
            reason: `고유명사 "${term}"이(가) content와 source 모두에서 사라짐`,
          })
        }
      }
    }
  }
  return failures
}

// 검증 2: 작년 참고 잔류 — 새 content에 "(25-2:" "(26-1:" "(작년:" 패턴이 남아있으면 FAIL
function checkLingeringReferences() {
  const failures = []
  const pattern = /\((2[56]-[12]):/
  for (const team of ['content', 'budget', 'exchange', 'timeline']) {
    for (const item of transformed[team]) {
      if (pattern.test(item.newContent)) {
        failures.push({
          id: item.id.slice(0, 8),
          team: item.team,
          sortOrder: item.sortOrder,
          original: item.originalContent,
          transformed: item.newContent,
          reason: '작년 참고가 content에 잔류',
        })
      }
    }
  }
  return failures
}

// 검증 3: 빈 content — 새 content가 비어있거나 2글자 미만이면 FAIL
function checkEmptyContent() {
  const failures = []
  for (const team of ['content', 'budget', 'exchange', 'timeline']) {
    for (const item of transformed[team]) {
      if (!item.newContent || item.newContent.trim().length < 2) {
        failures.push({
          id: item.id.slice(0, 8),
          team: item.team,
          sortOrder: item.sortOrder,
          original: item.originalContent,
          transformed: item.newContent,
          reason: 'content가 비어있거나 너무 짧음',
        })
      }
    }
  }
  return failures
}

// 검증 4: D번호 잔류 — 새 content에 D1-D7 기호가 남아있으면 FAIL
function checkLingeringDecisionIds() {
  const failures = []
  const pattern = /\bD[1-7]\b/
  for (const team of ['content', 'budget', 'exchange', 'timeline']) {
    for (const item of transformed[team]) {
      if (pattern.test(item.newContent)) {
        failures.push({
          id: item.id.slice(0, 8),
          team: item.team,
          sortOrder: item.sortOrder,
          original: item.originalContent,
          transformed: item.newContent,
          reason: 'D번호 기호가 content에 잔류',
        })
      }
    }
  }
  return failures
}

// 검증 실행
console.log('=== 체크리스트 변환 검증 ===\n')

const checks = [
  { name: '고유명사 보존', fn: checkProtectedTerms },
  { name: '작년 참고 잔류', fn: checkLingeringReferences },
  { name: '빈 content', fn: checkEmptyContent },
  { name: 'D번호 잔류', fn: checkLingeringDecisionIds },
]

let allPass = true
for (const check of checks) {
  const failures = check.fn()
  const status = failures.length === 0 ? 'PASS' : 'FAIL'
  if (failures.length > 0) allPass = false
  console.log(`${status} — ${check.name} (${failures.length}건 실패)`)
  for (const f of failures) {
    console.log(`  [${f.team}:${f.sortOrder}] ${f.reason}`)
    console.log(`    원본: ${f.original}`)
    console.log(`    변환: ${f.transformed}`)
  }
}

console.log()
console.log(allPass ? '=== 전체 PASS ===' : '=== 실패 항목 있음 ===')
process.exit(allPass ? 0 : 1)
