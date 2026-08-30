-- 데모 인스턴스 전용 RLS — 반드시 "데모 Supabase 프로젝트"에서만 실행할 것.
-- 운영 프로젝트에 실행하면 기획팀의 쓰기가 전부 막힌다. (운영 정책은 0002_rls_policies.sql)
--
-- 효과: anon은 모든 테이블을 읽기만 가능. insert/update/delete 정책을 제거해
-- anon key를 알아도 직접 쓰기가 불가능해진다 (RLS가 강제).

-- ===== 쓰기 정책 제거 (읽기 정책은 유지) =====
drop policy if exists "teams_open_write"        on public.teams;
drop policy if exists "teams_open_edit"         on public.teams;
drop policy if exists "teams_open_del"          on public.teams;

drop policy if exists "decisions_open_write"    on public.decisions;
drop policy if exists "decisions_open_edit"     on public.decisions;
drop policy if exists "decisions_open_del"      on public.decisions;

drop policy if exists "milestones_open_write"   on public.milestones;
drop policy if exists "milestones_open_edit"    on public.milestones;
drop policy if exists "milestones_open_del"     on public.milestones;

-- checklist_items는 0018에서 삭제된 테이블 — 정책 제거 불필요

drop policy if exists "issues_open_write"       on public.issues;
drop policy if exists "issues_open_edit"        on public.issues;
drop policy if exists "issues_open_del"         on public.issues;

drop policy if exists "handoffs_open_write"     on public.handoffs;
drop policy if exists "handoffs_open_edit"      on public.handoffs;
drop policy if exists "handoffs_open_del"       on public.handoffs;

drop policy if exists "drive_files_open_write"  on public.drive_files;
drop policy if exists "drive_files_open_edit"   on public.drive_files;
drop policy if exists "drive_files_open_del"    on public.drive_files;

-- ===== 감사 로그 쓰기 차단 =====
drop policy if exists "audit_open_write"        on public.audit_log;

-- ===== 구글 드라이브 토큰: 데모에는 연동 자체가 없으므로 쓰기도 차단 =====
drop policy if exists "tokens_write"            on public.drive_tokens;
drop policy if exists "tokens_update"           on public.drive_tokens;
drop policy if exists "tokens_delete"           on public.drive_tokens;
