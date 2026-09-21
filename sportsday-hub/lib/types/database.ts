import type {
  Team,
  Decision,
  Milestone,
  Issue,
  AuditLog,
  DriveToken,
  DriveFile,
  Handoff,
} from './models'

/** 연도 설정 행 (app_config) — 시즌 리셋 SQL로 UPSERT 된다
 *  (type alias 여야 postgrest 의 Record<string, unknown> 제약을 통과한다) */
export type AppConfigRow = {
  key: string
  value: string
  updated_at: string
}

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
      app_config: {
        Row: AppConfigRow
        Insert: Omit<AppConfigRow, 'updated_at'>
        Update: Partial<AppConfigRow>
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
