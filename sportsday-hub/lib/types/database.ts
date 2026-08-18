import type {
  Team,
  Decision,
  Milestone,
  ChecklistItem,
  Issue,
  AuditLog,
  DriveToken,
  DriveFile,
  Handoff,
} from './models'

// Supabase 자동 생성 타입과 호환되는 수동 정의
// (postgrest-js의 GenericSchema/GenericTable 호환을 위해 Relationships 포함)
export interface Database {
  public: {
    Tables: {
      teams: {
        Row: Team
        Insert: Partial<Team>
        Update: Partial<Team>
        Relationships: []
      }
      decisions: {
        Row: Decision
        Insert: Partial<Decision>
        Update: Partial<Decision>
        Relationships: []
      }
      milestones: {
        Row: Milestone
        Insert: Partial<Milestone>
        Update: Partial<Milestone>
        Relationships: []
      }
      checklist_items: {
        Row: ChecklistItem
        Insert: Partial<ChecklistItem>
        Update: Partial<ChecklistItem>
        Relationships: []
      }
      issues: {
        Row: Issue
        Insert: Partial<Issue>
        Update: Partial<Issue>
        Relationships: []
      }
      audit_log: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: Partial<AuditLog>
        Relationships: []
      }
      drive_tokens: {
        Row: DriveToken
        Insert: Partial<DriveToken>
        Update: Partial<DriveToken>
        Relationships: []
      }
      drive_files: {
        Row: DriveFile
        Insert: Partial<DriveFile>
        Update: Partial<DriveFile>
        Relationships: []
      }
      handoffs: {
        Row: Handoff
        Insert: Partial<Handoff>
        Update: Partial<Handoff>
        Relationships: []
      }
    }
    Views: Record<string, never>
    // RPC 함수
    // - set_user_context(p_nickname text) returns void
    // - update_guideline_section(p_team_id text, p_section_id text, p_content_md text) returns void
    Functions: {
      set_user_context: {
        Args: { p_nickname: string }
        Returns: undefined
      }
      update_guideline_section: {
        Args: {
          p_team_id: string
          p_section_id: string
          p_content_md: string
        }
        Returns: undefined
      }
    }
  }
}
