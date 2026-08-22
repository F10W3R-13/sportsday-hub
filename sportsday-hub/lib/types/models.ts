import { z } from 'zod'

// ===== 팀 =====
export const TEAM_IDS = [
  'management',
  'content',
  'budget',
  'exchange',
  'timeline',
] as const
export type TeamId = (typeof TEAM_IDS)[number]

export const teamSchema = z.object({
  id: z.enum(TEAM_IDS),
  name: z.string(),
  name_en: z.string(),
  color: z.string(),           // hex
  icon: z.string(),            // lucide 아이콘명
  sort_order: z.number(),
  mission: z.string(),
  guideline_doc: z.object({
    sections: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        order: z.number(),
        content_md: z.string(),
      })
    ),
  }),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
  drive_folder_id: z.string().nullable().optional(),
})
export type Team = z.infer<typeof teamSchema>

// ===== 결정 =====
export const DECISION_STATUS = [
  'confirmed',
  'discussing',
  'pending',
  'deferred',
] as const
export type DecisionStatus = (typeof DECISION_STATUS)[number]

export const decisionSchema = z.object({
  id: z.string(),              // 'D1'~'D7'
  title: z.string(),
  options: z.array(z.string()),
  status: z.enum(DECISION_STATUS),
  current_value: z.string().nullable(),
  decision_date: z.string().nullable(),
  sort_order: z.number(),
  notes: z.string().nullable(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
})
export type Decision = z.infer<typeof decisionSchema>

// ===== 마일스톤 =====
export const MILESTONE_CATEGORIES = [
  'meeting',
  'deliverable',
  'event',
] as const
export type MilestoneCategory = (typeof MILESTONE_CATEGORIES)[number]

export const PRIORITY = ['high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITY)[number]

// 체크리스트를 병합한 통합 엔터티 (구 checklist_items 포함)
export const milestoneSchema = z.object({
  id: z.string(),
  date: z.string().nullable(),          // null = 상시
  title: z.string(),
  team_id: z.string().nullable(),
  category: z.enum(MILESTONE_CATEGORIES),
  completed: z.boolean(),
  depends_on: z.array(z.string()).nullable().optional(),
  sort_order: z.number().optional(),
  priority: z.enum(PRIORITY).nullable().optional(),
  source: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
})
export type Milestone = z.infer<typeof milestoneSchema>

// ===== 이슈 =====
export const ISSUE_STATUS = ['open', 'in_progress', 'resolved'] as const
export type IssueStatus = (typeof ISSUE_STATUS)[number]

export const issueSchema = z.object({
  id: z.string().uuid(),
  team_id: z.enum(TEAM_IDS).nullable(),
  date: z.string().nullable(),
  title: z.string(),
  status: z.enum(ISSUE_STATUS),
  notes: z.string().nullable(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
})
export type Issue = z.infer<typeof issueSchema>

// ===== 상태 배지 매핑 =====
export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  confirmed: '확정',
  discussing: '논의중',
  pending: '미정',
  deferred: '보류',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
}

// ===== 감사 로그 (Plan B) =====
export const AUDIT_ACTIONS = ['insert', 'update', 'delete'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  table_name: z.string(),
  record_id: z.string(),
  action: z.enum(AUDIT_ACTIONS),
  changed_by: z.string().default('익명'),
  old_value: z.any().nullable(),
  new_value: z.any().nullable(),
  created_at: z.string().optional(),
  team_id: z.enum(TEAM_IDS).nullable().optional(),
})
export type AuditLog = z.infer<typeof auditLogSchema>

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  insert: '생성',
  update: '수정',
  delete: '삭제',
}

// ===== 구글 드라이브 연동 =====
export const driveTokenSchema = z.object({
  id: z.number(),
  email: z.string().nullable(),
  access_token: z.string().nullable(),
  refresh_token: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})
export type DriveToken = z.infer<typeof driveTokenSchema>

export const driveFileSchema = z.object({
  id: z.string().uuid(),
  team_id: z.enum(TEAM_IDS),
  file_id: z.string(),
  name: z.string(),
  mime_type: z.string().nullable(),
  icon_link: z.string().nullable(),
  modified_time: z.string().nullable(),
  modified_by: z.string().nullable(),
  created_time: z.string().nullable().optional(),
  web_view_link: z.string().nullable(),
  last_synced: z.string().optional(),
})
export type DriveFile = z.infer<typeof driveFileSchema>

// 전체 팀 파일 피드 — 드라이브 파일 + 병합된 팀 메타 (스펙 §4)
export type RecentFileItem = DriveFile & {
  team: { id: TeamId; name: string; color: string; icon: string }
}

// ===== 인계 (handoffs) — 팀 간 파일 공유 2단계 =====
export const handoffSchema = z.object({
  id: z.string().uuid(),
  from_team_id: z.enum(TEAM_IDS),
  to_team_id: z.enum(TEAM_IDS).nullable(),
  to_external: z.string().nullable(),   // 외부 조직명 (홍보부 등) — to_team_id와 상호배타
  title: z.string(),
  due_date: z.string().nullable(),      // 'YYYY-MM-DD' or null (기한 없음)
  completed: z.boolean(),
  item_id: z.string().nullable(),
  sort_order: z.number(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
})
export type Handoff = z.infer<typeof handoffSchema>

// 팀 메타·마일스톤 맥락 병합형 (getHandoffs가 반환)
export type HandoffItem = Handoff & {
  from_team: { id: TeamId; name: string; color: string }
  to_team: { id: TeamId; name: string; color: string } | null
  item_title: string | null         // 링크된 항목 제목 (표시 라벨용)
  item_team_id: TeamId | null       // 링크된 항목의 소속 팀 — 딥링크 대상
}

// ===== 봇 실행 보고 (bot_runs) — 단체방 봇 신뢰성 =====
export const botRunSchema = z.object({
  id: z.string().uuid(),
  run_date: z.string(),             // 'YYYY-MM-DD' (KST 기준)
  status: z.enum(['success', 'fail']),
  detail: z.string().nullable(),    // 실패 사유 등
  created_at: z.string().optional(),
})
export type BotRun = z.infer<typeof botRunSchema>
