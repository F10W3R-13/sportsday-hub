import { TEAM_IDS, type TeamId, type RecentFileItem } from '@/lib/types/models'

// 동기화 신선도: 마지막 동기화가 이 시간 이내면 재동기화 스킵 (스펙 §6)
export const SYNC_FRESHNESS_MS = 5 * 60 * 1000

// NEW 배지 기준: 생성 후 이 시간 이내면 "새 파일" (스펙 §5, 72시간)
export const NEW_FILE_MS = 72 * 60 * 60 * 1000

export function shouldSkipSync(
  lastSyncedAt: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!lastSyncedAt) return false
  const last = new Date(lastSyncedAt).getTime()
  if (Number.isNaN(last)) return false
  return now - last < SYNC_FRESHNESS_MS
}

export function isNewFile(
  createdTime: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!createdTime) return false
  const created = new Date(createdTime).getTime()
  if (Number.isNaN(created)) return false
  return now - created < NEW_FILE_MS
}

// ?team= 파라미터 → 팀 필터. null은 '전체'. 무효 값도 '전체' 폴백 (스펙 §5).
export function parseTeamFilter(param: string | null | undefined): TeamId | null {
  if (!param) return null
  return (TEAM_IDS as readonly string[]).includes(param) ? (param as TeamId) : null
}

// DriveSyncTrigger가 router.refresh()를 호출할지 판정.
// 실제 동기화가 수행됐을 때만 갱신 — 신선도 스킵·실패는 무연산 (스펙 §5).
export function shouldRefreshAfterSync(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const d = data as { success?: boolean; skipped?: boolean }
  return d.success === true && d.skipped !== true
}

// 파일 피드에서 동일 파일(id 또는 이름이 하나라도 일치) 중복 노출 제거 — 최근 수정본 우선
export function dedupeRecentFiles(files: RecentFileItem[]): RecentFileItem[] {
  const parent: number[] = []
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  // 먼저 등장한 인덱스를 대표로 — 원본 순서 보존
  const union = (a: number, b: number): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    if (ra < rb) parent[rb] = ra
    else parent[ra] = rb
  }

  const idIdx = new Map<string, number>()
  const nameIdx = new Map<string, number>()
  files.forEach((f, i) => {
    parent.push(i)
    if (f.id) {
      const prev = idIdx.get(f.id)
      if (prev !== undefined) union(prev, i)
      else idIdx.set(f.id, i)
    }
    const prevName = nameIdx.get(f.name)
    if (prevName !== undefined) union(prevName, i)
    else nameIdx.set(f.name, i)
  })

  const best = new Map<number, RecentFileItem>()
  for (const [i, f] of files.entries()) {
    const r = find(i)
    const cur = best.get(r)
    if (!cur || (f.modified_time ?? '') > (cur.modified_time ?? '')) best.set(r, f)
  }

  const out: RecentFileItem[] = []
  const seen = new Set<number>()
  for (let i = 0; i < files.length; i++) {
    const r = find(i)
    if (!seen.has(r)) {
      seen.add(r)
      out.push(best.get(r)!)
    }
  }
  return out
}
