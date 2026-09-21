/**
 * 소관 매핑 검증 — 순수 로직 모듈
 *
 * 마스터 지침의 YAML 매핑을 파싱하고, 회의/사전공유 문서에서
 * 외부 컨택 키워드가 특정 팀에 월권 할당되는지 검사한다.
 */
import yaml from 'js-yaml'

export type TeamName =
  | '기획관리팀'
  | '컨텐츠팀'
  | '예산팀'
  | '교환담당팀'
  | '타임라인/인원관리팀'

export interface ScopeMapping {
  teams: Record<string, { owns: string[] }>
  external: string[]
}

export interface Violation {
  type: 'external-in-team-doc'
  file: string
  line: number
  keyword: string
  team: string
  detail: string
}

// 팀명 별칭 — 파일명/폴더명 매칭용
const TEAM_ALIASES: Array<{ team: TeamName; aliases: string[] }> = [
  { team: '기획관리팀', aliases: ['기획관리팀', '기획관리'] },
  { team: '컨텐츠팀', aliases: ['컨텐츠팀', '컨텐츠'] },
  { team: '예산팀', aliases: ['예산팀'] },
  { team: '교환담당팀', aliases: ['교환담당팀', '교환'] },
  { team: '타임라인/인원관리팀', aliases: ['타임라인', '인원관리'] },
]

/** 마스터 마크다운에서 "소관 매핑" 제목 아래 첫 yaml 펜스 추출 */
export function extractMappingYaml(markdown: string): string {
  const headingIdx = markdown.indexOf('소관 매핑')
  if (headingIdx === -1) return ''
  const after = markdown.slice(headingIdx)
  // CRLF/LF 모두 허용
  const fenceMatch = after.match(/```yaml\r?\n([\s\S]*?)```/)
  return fenceMatch ? fenceMatch[1] : ''
}

/** YAML 텍스트 → ScopeMapping */
export function parseMapping(yamlText: string): ScopeMapping {
  if (!yamlText.trim()) {
    throw new Error('매핑 YAML이 비어 있습니다. 마스터 지침의 소관 매핑 블록을 확인하세요.')
  }
  const raw = yaml.load(yamlText) as {
    teams: Record<string, { owns: string[] }>
    external_contacts?: { 대상?: string[] }
  }
  return {
    teams: raw.teams,
    external: raw.external_contacts?.대상 ?? [],
  }
}

/** 파일 경로에서 소속 팀 추론 (없으면 null) */
export function inferDocTeam(filePath: string): TeamName | null {
  const normalized = filePath.replace(/\\/g, '/')
  for (const { team, aliases } of TEAM_ALIASES) {
    if (aliases.some((a) => normalized.includes(a))) return team
  }
  return null
}

/** 본문에서 외부 키워드 등장 위치 탐지 */
export function findExternalMentions(
  text: string,
  keywords: string[]
): Array<{ keyword: string; line: number }> {
  const lines = text.split('\n')
  const hits: Array<{ keyword: string; line: number }> = []
  lines.forEach((line, i) => {
    for (const kw of keywords) {
      if (line.includes(kw)) {
        hits.push({ keyword: kw, line: i + 1 })
        break // 한 줄에 여러 키워드면 첫 것만
      }
    }
  })
  return hits
}

// 담당 할당으로 간주할 문서 (파일명/경로 키워드)
const MEETING_DOC_MARKERS = ['회의', '안건', '사전 공유', '안내']

// 담당 컬럼 헤더로 인식할 키워드
const OWNER_HEADER_KEYWORDS = ['담당', '소관', '준비', '발표 담당', '발표']
// 할 일 컬럼 헤더로 인식할 키워드
const TASK_HEADER_KEYWORDS = ['할 일', '업무', '항목', '내용', '건의']

// 경유 라인 면제 — 같은 행에 있으면 외부 키워드가 정상 참조로 간주
const RELAY_MARKERS = [
  '기관팀',
  '임원진',
  '총무',
  '경유',
  '기획부장',
  '기획관리팀장',
  '기획관리',
]

/** 경유 라인이 행에 있는지 (정상 참조 면제 판정) */
function hasRelayMarker(text: string): boolean {
  return RELAY_MARKERS.some((m) => text.includes(m))
}

/** 담당 할당 표의 데이터 행 추출 — 마크다운 표에서 담당/할일 컬럼 쌍을 찾아 반환 */
export function extractAssignmentRows(
  markdown: string
): Array<{ line: number; task: string; owner: string }> {
  const lines = markdown.split(/\r?\n/)
  const rows: Array<{ line: number; task: string; owner: string }> = []

  let ownerCol = -1
  let taskCol = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim().startsWith('|')) {
      // 표가 끊기면 컬럼 인덱스 리셋 (다음 표에서 재탐지)
      ownerCol = -1
      taskCol = -1
      continue
    }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())

    // 구분선(|---|---|)은 건너뜀
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue

    // 헤더 행 — 담당/할일 컬럼 인덱스 식별 (아직 못 찾은 경우만)
    if (ownerCol === -1 || taskCol === -1) {
      cells.forEach((cell, idx) => {
        if (OWNER_HEADER_KEYWORDS.some((k) => cell.includes(k))) ownerCol = idx
        if (TASK_HEADER_KEYWORDS.some((k) => cell.includes(k))) taskCol = idx
      })
      // 두 컬럼 모두 식별되면 헤더로 확정, 다음 행부터 데이터
      if (ownerCol !== -1 && taskCol !== -1) continue
    }

    // 데이터 행 — 두 컬럼 모두 유효하고 비어있지 않을 때
    if (ownerCol !== -1 && taskCol !== -1) {
      const owner = cells[ownerCol] ?? ''
      const task = cells[taskCol] ?? ''
      if (owner && task) {
        rows.push({ line: i + 1, task, owner })
      }
    }
  }
  return rows
}

/**
 * 단일 문서 검사.
 * 규칙: 담당 할당 표(회의 문서 한정)에서 "할 일"에 외부 키워드가 있고
 * "담당"에 5팀 중 하나가 할당되어 있으면 월권.
 * 단, 같은 행에 경유 라인(기관팀/임원진/총무 등)이 있으면 정상 참조로 면제.
 */
export function checkDoc(
  filePath: string,
  markdown: string,
  mapping: ScopeMapping
): Violation[] {
  // B 조건: 회의/사전공유/안건서 문서만 검사 (지침 등은 담당 할당 문서 아님)
  const isMeetingDoc = MEETING_DOC_MARKERS.some((m) => filePath.includes(m))
  if (!isMeetingDoc) return []

  const rows = extractAssignmentRows(markdown)
  const violations: Violation[] = []

  for (const row of rows) {
    // 담당 셀이 5팀 중 하나인지 (팀 소속 아니면 담당 할당 아님 — 무시)
    const ownerTeam = inferDocTeam(row.owner)
    if (!ownerTeam) continue

    // 할 일 셀에 외부 키워드가 있는지
    const rowExternal = mapping.external.filter((kw) => row.task.includes(kw))
    if (rowExternal.length === 0) continue

    // 경유 라인 면제 — 같은 행(담당 또는 할 일 셀)에 경유 표시 있으면 정상
    if (hasRelayMarker(row.owner) || hasRelayMarker(row.task)) continue

    for (const kw of rowExternal) {
      violations.push({
        type: 'external-in-team-doc',
        file: filePath,
        line: row.line,
        keyword: kw,
        team: ownerTeam,
        detail: `"${kw}" 은(는) 외부 컨택(5팀 소관 아님)인데 ${ownerTeam} 에 담당 할당됨. 임원진/기관팀 경유 영역입니다. (경유 라인 명시 시 면제)`,
      })
    }
  }
  return violations
}
