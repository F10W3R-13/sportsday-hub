-- Plan B: audit_log + soft-delete + 닉네임 세션 변수

-- ===== audit_log 테이블 =====
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   text not null,
  action      text not null check (action in ('insert','update','delete')),
  changed_by  text not null default '익명',
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_table_record
  on public.audit_log(table_name, record_id);
create index if not exists idx_audit_log_created
  on public.audit_log(created_at desc);

-- ===== audit_log RLS (열린 편집과 동일) =====
alter table public.audit_log enable row level security;
create policy "audit_open_read"  on public.audit_log for select using (true);
create policy "audit_open_write" on public.audit_log for insert with check (true);

-- ===== 닉네임 세션 변수 설정 RPC =====
-- 클라이언트가 supabase.rpc('set_user_context', { p_nickname: '지훈' }) 호출
create or replace function public.set_user_context(p_nickname text)
returns void as $$
begin
  perform set_config('app.changed_by', coalesce(p_nickname, '익명'), true);
end;
$$ language plpgsql security definer;

-- ===== audit 트리거 함수 =====
-- 모든 대상 테이블의 INSERT/UPDATE/DELETE를 캡처
create or replace function public.audit_capture()
returns trigger as $$
begin
  insert into public.audit_log (table_name, record_id, action, changed_by, old_value, new_value)
  values (
    tg_table_name,
    coalesce((new).id::text, (old).id::text),
    tg_op,
    coalesce(current_setting('app.changed_by', true), '익명'),
    case when tg_op in ('update','delete') then to_jsonb(old) - 'guideline_doc' end,
    case when tg_op in ('insert','update') then to_jsonb(new) - 'guideline_doc' end
  );
  return coalesce(new, old);
end;
$$ language plpgsql;

-- ===== 트리거 부착 (5개 테이블) =====
drop trigger if exists trg_audit_decisions       on public.decisions;
drop trigger if exists trg_audit_milestones       on public.milestones;
drop trigger if exists trg_audit_checklist_items  on public.checklist_items;
drop trigger if exists trg_audit_issues           on public.issues;

create trigger trg_audit_decisions
  after insert or update or delete on public.decisions
  for each row execute function public.audit_capture();

create trigger trg_audit_milestones
  after insert or update or delete on public.milestones
  for each row execute function public.audit_capture();

create trigger trg_audit_checklist_items
  after insert or update or delete on public.checklist_items
  for each row execute function public.audit_capture();

create trigger trg_audit_issues
  after insert or update or delete on public.issues
  for each row execute function public.audit_capture();

-- teams는 guideline_doc(JSONB, 큼)을 제외하고 캡처 (위 함수에서 - 'guideline_doc' 처리)
drop trigger if exists trg_audit_teams on public.teams;
create trigger trg_audit_teams
  after insert or update or delete on public.teams
  for each row execute function public.audit_capture();

-- ===== soft-delete: deleted_at 컬럼 추가 =====
alter table public.teams           add column if not exists deleted_at timestamptz;
alter table public.decisions       add column if not exists deleted_at timestamptz;
alter table public.milestones      add column if not exists deleted_at timestamptz;
alter table public.checklist_items add column if not exists deleted_at timestamptz;
alter table public.issues          add column if not exists deleted_at timestamptz;
