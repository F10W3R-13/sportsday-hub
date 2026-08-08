import type {
  Team,
  Decision,
  Milestone,
  ChecklistItem,
  Issue,
  AuditLog,
} from './models'

// Supabase 자동 생성 타입과 호환되는 수동 정의
export interface Database {
  public: {
    Tables: {
      teams: {
        Row: Team
        Insert: Partial<Team>
        Update: Partial<Team>
      }
      decisions: {
        Row: Decision
        Insert: Partial<Decision>
        Update: Partial<Decision>
      }
      milestones: {
        Row: Milestone
        Insert: Partial<Milestone>
        Update: Partial<Milestone>
      }
      checklist_items: {
        Row: ChecklistItem
        Insert: Partial<ChecklistItem>
        Update: Partial<ChecklistItem>
      }
      issues: {
        Row: Issue
        Insert: Partial<Issue>
        Update: Partial<Issue>
      }
      audit_log: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: Partial<AuditLog>
      }
    }
  }
}
