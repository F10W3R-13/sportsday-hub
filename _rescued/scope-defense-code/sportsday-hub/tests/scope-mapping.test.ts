import { describe, expect, it } from 'vitest'
import {
  extractMappingYaml,
  parseMapping,
  inferDocTeam,
  findExternalMentions,
  extractAssignmentRows,
  checkDoc,
  type ScopeMapping,
} from '../scripts/lib/scope-mapping'

const SAMPLE_MASTER = `# 마스터

## 🔐 소관 매핑 (단일 진본)

\`\`\`yaml
teams:
  교환담당팀:
    owns:
      - 구글폼
      - 카드뉴스
external_contacts:
  대상:
    - 국제처
    - 총학
  실행주체: 임원진 경유
\`\`\`
`

describe('extractMappingYaml', () => {
  it('소관 매핑 제목 아래 yaml 펜스 내용을 추출한다', () => {
    const yaml = extractMappingYaml(SAMPLE_MASTER)
    expect(yaml).toContain('teams:')
    expect(yaml).toContain('국제처')
    expect(yaml).toContain('external_contacts:')
  })

  it('매핑 섹션이 없으면 빈 문자열', () => {
    expect(extractMappingYaml('# 그냥 문서\n본문')).toBe('')
  })
})

describe('parseMapping', () => {
  it('YAML을 ScopeMapping으로 파싱한다', () => {
    const yaml = extractMappingYaml(SAMPLE_MASTER)
    const mapping = parseMapping(yaml)
    expect(mapping.teams['교환담당팀'].owns).toEqual(['구글폼', '카드뉴스'])
    expect(mapping.external).toEqual(['국제처', '총학'])
  })
})

describe('inferDocTeam', () => {
  it('파일명의 (X팀용) 에서 팀 추론', () => {
    expect(inferDocTeam('교환담당팀/2차 회의 사전 공유 (교환담당팀용).md')).toBe('교환담당팀')
  })
  it('폴더명에서 팀 추론', () => {
    expect(inferDocTeam('예산팀/예산팀_지침.md')).toBe('예산팀')
  })
  it('팀 소속 아니면 null', () => {
    expect(inferDocTeam('2차 회의 안건서 (진행용).md')).toBeNull()
  })
  it('타임라인 별칭', () => {
    expect(inferDocTeam('타임라인_인원관리팀/x.md')).toBe('타임라인/인원관리팀')
  })
})

describe('findExternalMentions', () => {
  const mapping: ScopeMapping = {
    teams: { '교환담당팀': { owns: ['구글폼'] } },
    external: ['국제처', '총학'],
  }
  it('외부 키워드 등장 위치 반환', () => {
    const text = '구글폼 제작\n국제처 컨택 사항\n'
    const hits = findExternalMentions(text, mapping.external)
    expect(hits).toEqual([{ keyword: '국제처', line: 2 }])
  })
  it('외부 키워드 없으면 빈 배열', () => {
    expect(findExternalMentions('구글폼만', mapping.external)).toEqual([])
  })
})

describe('extractAssignmentRows', () => {
  it('담당/할일 헤더가 있는 표에서 데이터 행 추출', () => {
    const md = `본문

| 할 일 | 담당 | 기한 |
|---|---|---|
| 구글폼 제작 | 교환담당팀 | 8/20 |
| 예산안 작성 | 예산팀 | 8/25 |
`
    const rows = extractAssignmentRows(md)
    expect(rows.length).toBe(2)
    expect(rows[0]).toEqual({ line: 5, task: '구글폼 제작', owner: '교환담당팀' })
    expect(rows[1]).toEqual({ line: 6, task: '예산안 작성', owner: '예산팀' })
  })

  it('담당/할일 헤더 없는 표는 무시', () => {
    const md = `| 단계 | 의미 |\n|---|---|\n| 🟢 확정 | 확인만 |\n`
    expect(extractAssignmentRows(md)).toEqual([])
  })
})

describe('checkDoc', () => {
  const mapping: ScopeMapping = {
    teams: {
      '교환담당팀': { owns: ['구글폼', '카드뉴스'] },
      '예산팀': { owns: ['예산안'] },
    },
    external: ['국제처', '총학', '동아리 보전'],
  }

  it('담당 표에서 외부 키워드 할 일에 팀 담당 → 월권 위반', () => {
    const md = `| 할 일 | 담당 | 기한 |
|---|---|---|
| 국제처 컨택 사항 정리 | 교환담당팀 | 8/16 |
`
    const violations = checkDoc(
      '교환담당팀/2차 회의 사전 공유 (교환담당팀용).md',
      md,
      mapping
    )
    expect(violations.length).toBe(1)
    expect(violations[0].keyword).toBe('국제처')
    expect(violations[0].team).toBe('교환담당팀')
  })

  it('경유 라인(기관팀/총무 등) 같은 행에 있으면 면제', () => {
    const md = `| 할 일 | 담당 | 기한 |
|---|---|---|
| 동아리 보전 한도 파악 (총무/기관팀) | 예산팀 | 8/16 |
`
    const violations = checkDoc(
      '예산팀/2차 회의 사전 공유 (예산팀용).md',
      md,
      mapping
    )
    expect(violations).toEqual([]) // 총무/기관팀 경유 명시 → 정상
  })

  it('회의 문서가 아니면(지침 등) 검사 안 함', () => {
    const md = `| 할 일 | 담당 |\n|---|---|\n| 국제처 | 예산팀 |\n`
    const violations = checkDoc('예산팀/예산팀_지침.md', md, mapping)
    expect(violations).toEqual([]) // 지침은 담당 할당 문서 아님
  })

  it('본문 산문의 외부 키워드 언급은 위반 아님 (표 밖)', () => {
    const md = `### 회의 전 할 일\n국제처 컨택은 임원진 경유라 시간이 걸린다.\n`
    const violations = checkDoc(
      '교환담당팀/2차 회의 사전 공유 (교환담당팀용).md',
      md,
      mapping
    )
    expect(violations).toEqual([])
  })

  it('담당 셀이 팀이 아니면(공란/기타) 위반 아님', () => {
    const md = `| 할 일 | 담당 |\n|---|---|\n| 국제처 컨택 |  |\n`
    const violations = checkDoc(
      '교환담당팀/2차 회의 사전 공유 (교환담당팀용).md',
      md,
      mapping
    )
    expect(violations).toEqual([])
  })
})
