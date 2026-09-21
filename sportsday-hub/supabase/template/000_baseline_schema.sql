-- ═══════════════════════════════════════════════════════════════════
--  스포츠데이 허브 — 신규 시즌 베이스라인 스키마 (원샷)
-- ═══════════════════════════════════════════════════════════════════
--  사용법 (자세히: ../../HANDOVER/01_연초_셋업.md)
--    새 Supabase 프로젝트를 만들고 SQL Editor 에 이 파일 전체를 붙여넣어 실행한다.
--    실행 직후는 모든 테이블이 비어 있다 — 이어서 `npm run migrate:md` 로
--    생성한 시드 SQL(content-source 기반)을 실행해 올해 콘텐츠를 채운다.
--
--  구성 (migrations/ 의 스키마 변경만 통합, 26-2 실데이터 시드는 제외):
--    0001 초기 스키마 · 0002 오픈 RLS · 0003 감사·소프트딜리트 · 0004 세션컨텍스트 수정
--    0006 감사 트리거 케이스 수정 · 0007 드라이브 연동 · 0008 중 DDL(체크리스트↔마일스톤)
--    0013 drive_files.created_time · 0014 중 DDL(인계 테이블) · 0018 체크리스트→마일스톤 병합
--    0019 삽입 잠금(app_locks)
--  제외: 0005·0009~0011·0015~0017·0021(26-2 데이터), 0012(0018이 제거하는 트리거),
--        0020+0022(bot_runs 생성·제거 — 상쇄)
--  주의: 이미 데이터가 있는 기존 프로젝트에서 실행하지 말 것.
--  (0018의 *_backup_0018 백업 테이블은 새 프로젝트에서는 빈 껍데기로 남는다 — 무해)

-- ────────── 0001 초기 스키마 ──────────
-- 26-2 스포츠데이 허브 초기 스키마

-- pgcrypto (gen_random_uuid)는 Supabase에 기본 활성화되어 있음

-- ===== teams =====
create table public.teams (
  id            text primary key,
  name          text not null,
  name_en       text not null,
  color         text not null,
  icon          text not null,
  sort_order    int not null,
  mission       text not null,
  guideline_doc jsonb not null default '{"sections":[]}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ===== decisions =====
create table public.decisions (
  id            text primary key,
  title         text not null,
  options       text[] not null default '{}',
  status        text not null default 'pending'
                  check (status in ('confirmed','discussing','pending','deferred')),
  current_value text,
  decision_date date,
  sort_order    int not null default 0,
  notes         text,
  updated_at    timestamptz not null default now()
);

-- ===== milestones =====
create table public.milestones (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  title       text not null,
  team_id     text references public.teams(id) on delete set null,
  category    text not null default 'deliverable'
                check (category in ('meeting','deliverable','event')),
  completed   boolean not null default false,
  depends_on  uuid[] default null,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

-- ===== checklist_items =====
create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  team_id     text references public.teams(id) on delete cascade,
  section     text not null default 'progress'
                check (section in ('progress','feedback','prep')),
  content     text not null,
  priority    text check (priority in ('high','medium','low')),
  completed   boolean not null default false,
  source      text,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

-- ===== issues =====
create table public.issues (
  id          uuid primary key default gen_random_uuid(),
  team_id     text references public.teams(id) on delete cascade,
  date        date,
  title       text not null,
  status      text not null default 'open'
                check (status in ('open','in_progress','resolved')),
  notes       text,
  updated_at  timestamptz not null default now()
);

-- ===== updated_at 자동 갱신 트리거 =====
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_teams_updated    before update on public.teams
  for each row execute function public.touch_updated_at();
create trigger trg_decisions_updated before update on public.decisions
  for each row execute function public.touch_updated_at();
create trigger trg_milestones_updated before update on public.milestones
  for each row execute function public.touch_updated_at();
create trigger trg_checklist_updated before update on public.checklist_items
  for each row execute function public.touch_updated_at();
create trigger trg_issues_updated   before update on public.issues
  for each row execute function public.touch_updated_at();

-- ────────── 0002 RLS ──────────
-- RLS 활성화 (열린 편집: anon 전권)
alter table public.teams           enable row level security;
alter table public.decisions       enable row level security;
alter table public.milestones      enable row level security;
alter table public.checklist_items enable row level security;
alter table public.issues          enable row level security;

-- ===== teams =====
create policy "teams_open_read"  on public.teams for select using (true);
create policy "teams_open_write" on public.teams for insert with check (true);
create policy "teams_open_edit"  on public.teams for update using (true);
create policy "teams_open_del"   on public.teams for delete using (true);

-- ===== decisions =====
create policy "decisions_open_read"  on public.decisions for select using (true);
create policy "decisions_open_write" on public.decisions for insert with check (true);
create policy "decisions_open_edit"  on public.decisions for update using (true);
create policy "decisions_open_del"   on public.decisions for delete using (true);

-- ===== milestones =====
create policy "milestones_open_read"  on public.milestones for select using (true);
create policy "milestones_open_write" on public.milestones for insert with check (true);
create policy "milestones_open_edit"  on public.milestones for update using (true);
create policy "milestones_open_del"   on public.milestones for delete using (true);

-- ===== checklist_items =====
create policy "checklist_open_read"  on public.checklist_items for select using (true);
create policy "checklist_open_write" on public.checklist_items for insert with check (true);
create policy "checklist_open_edit"  on public.checklist_items for update using (true);
create policy "checklist_open_del"   on public.checklist_items for delete using (true);

-- ===== issues =====
create policy "issues_open_read"  on public.issues for select using (true);
create policy "issues_open_write" on public.issues for insert with check (true);
create policy "issues_open_edit"  on public.issues for update using (true);
create policy "issues_open_del"   on public.issues for delete using (true);

-- ────────── 0003 감사·소프트딜리트 ──────────
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

-- ────────── 0004 세션컨텍스트 수정 ──────────
-- C2 fix: set_user_context의 is_local을 false로 변경 (세션 스코프)
-- 기존 0003에서 true(트랜잭션 스코프)로 설정되어 있어 실제 쓰기 시점에는 사라지는 문제 해결.
-- false로 설정하면 세션 전체에서 유지되어 audit 트리거가 닉네임을 읽을 수 있음.
create or replace function public.set_user_context(p_nickname text)
returns void as $$
begin
  perform set_config('app.changed_by', coalesce(p_nickname, '익명'), false);
end;
$$ language plpgsql security definer;

-- C3 fix: 가이드라인 섹션 원자적 업데이트 RPC
-- 클라이언트에서 read-modify-write(전체 guideline_doc 덮어쓰기)를 하면
-- 동시 편집 시 데이터 유실이 발생하므로, 서버에서 JSONB를 원자적으로 갱신.
create or replace function public.update_guideline_section(
  p_team_id text,
  p_section_id text,
  p_content_md text
) returns void as $$
declare
  doc jsonb;
begin
  select guideline_doc into doc from public.teams where id = p_team_id;
  if doc is null then return; end if;

  doc := jsonb_set(
    doc,
    '{sections}',
    (
      select jsonb_agg(
        case
          when (s->>'id') = p_section_id
          then jsonb_set(s, '{content_md}', to_jsonb(p_content_md))
          else s
        end
      )
      from jsonb_array_elements(doc->'sections') as s
    )
  );

  update public.teams set guideline_doc = doc where id = p_team_id;
end;
$$ language plpgsql security definer;

-- ────────── 0006 감사 트리거 케이스 수정 (0003 대체) ──────────
-- Fix: tg_op는 대문자('UPDATE')를 반환하지만 audit_log CHECK 제약조건은 소문자('update')를 요구
-- audit_capture() 함수에서 lower(tg_op)를 사용하도록 수정

create or replace function public.audit_capture()
returns trigger as $$
begin
  insert into public.audit_log (table_name, record_id, action, changed_by, old_value, new_value)
  values (
    tg_table_name,
    coalesce((new).id::text, (old).id::text),
    lower(tg_op),
    coalesce(current_setting('app.changed_by', true), '익명'),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - 'guideline_doc' end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) - 'guideline_doc' end
  );
  return coalesce(new, old);
end;
$$ language plpgsql;

-- ────────── 0007 드라이브 연동 ──────────
-- 구글 드라이브 연동: 토큰 + 파일 캐시 + audit team_id

-- ===== drive_tokens (싱글톤, 관리자 OAuth 토큰) =====
create table if not exists public.drive_tokens (
  id            int primary key default 1 check (id = 1),
  email         text,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS: 클라이언트 읽기 차단, 쓰기 허용 (서버는 service_role로 우회)
alter table public.drive_tokens enable row level security;
create policy "tokens_no_read"  on public.drive_tokens for select using (false);
create policy "tokens_write"    on public.drive_tokens for insert with check (true);
create policy "tokens_update"   on public.drive_tokens for update using (true);
create policy "tokens_delete"   on public.drive_tokens for delete using (true);

-- updated_at 트리거
create trigger trg_drive_tokens_updated
  before update on public.drive_tokens
  for each row execute function public.touch_updated_at();

-- ===== drive_files (파일 메타데이터 캐시) =====
create table if not exists public.drive_files (
  id            uuid primary key default gen_random_uuid(),
  team_id       text not null references public.teams(id) on delete cascade,
  file_id       text not null unique,
  name          text not null,
  mime_type     text,
  icon_link     text,
  modified_time timestamptz,
  modified_by   text,
  web_view_link text,
  last_synced   timestamptz not null default now()
);

create index if not exists idx_drive_files_team on public.drive_files(team_id);
create index if not exists idx_drive_files_modified on public.drive_files(modified_time desc);

alter table public.drive_files enable row level security;
create policy "drive_files_open_read"  on public.drive_files for select using (true);
create policy "drive_files_open_write" on public.drive_files for insert with check (true);
create policy "drive_files_open_edit"  on public.drive_files for update using (true);
create policy "drive_files_open_del"   on public.drive_files for delete using (true);

-- ===== teams에 drive_folder_id 컬럼 추가 =====
alter table public.teams add column if not exists drive_folder_id text;

-- ===== audit_log에 team_id 컬럼 추가 (활동 피드용) =====
alter table public.audit_log add column if not exists team_id text;

create index if not exists idx_audit_log_team on public.audit_log(team_id);

-- ────────── 0008 중 스키마만 (시드 재매핑 제외) ──────────
-- ===== 스키마 변경 =====
-- milestone_id FK 추가 (nullable: NULL = 상시 버킷)
alter table public.checklist_items
  add column if not exists milestone_id uuid
  references public.milestones(id) on delete set null;

-- 인덱스 (마일스톤별 조회 빈도 high)
create index if not exists idx_checklist_items_milestone_id
  on public.checklist_items (milestone_id);

-- section 컬럼 제거
alter table public.checklist_items drop column if exists section;

-- ────────── 0013 drive_files.created_time ──────────
-- 0013: 전체 팀 파일 피드 — 신규/수정 구분용 created_time 캡처
-- 기존 행은 null로 시작, 다음 동기화 upsert 시 값이 채워진다.
BEGIN;

alter table public.drive_files
  add column if not exists created_time timestamptz;

COMMIT;

-- ────────── 0014 중 스키마만 (초기 시드 5건 제외) ──────────
-- 0014: 인계(handoffs) 추적 — 팀 간 파일 공유 2단계
-- 스펙: docs/superpowers/specs/2026-08-18-인계추적-design.md
-- 시드의 체크리스트 링크 ID는 0005 기준. 1차(8/16)는 지연 배지로 즉시 노출 — 의도됨.

BEGIN;

create table public.handoffs (
  id uuid primary key default gen_random_uuid(),
  from_team_id text not null references public.teams(id),
  to_team_id text references public.teams(id),
  to_external text,
  title text not null,
  due_date date,
  completed boolean not null default false,
  checklist_item_id uuid references public.checklist_items(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint handoffs_to_exactly_one check (
    (to_team_id is not null and to_external is null) or
    (to_team_id is null and to_external is not null)
  )
);

create index if not exists idx_handoffs_due on public.handoffs(due_date);
create index if not exists idx_handoffs_completed on public.handoffs(completed);

alter table public.handoffs enable row level security;
create policy "handoffs_open_read"  on public.handoffs for select using (true);
create policy "handoffs_open_write" on public.handoffs for insert with check (true);
create policy "handoffs_open_edit"  on public.handoffs for update using (true);
create policy "handoffs_open_del"   on public.handoffs for delete using (true);

-- 감사 트리거 (0003 audit_capture 재사용 — audit_log에 team_id 컬럼 없음, 기존 5테이블과 동일하게 미기록)
drop trigger if exists trg_audit_handoffs on public.handoffs;
create trigger trg_audit_handoffs
  after insert or update or delete on public.handoffs
  for each row execute function public.audit_capture();
COMMIT;

-- ────────── 0018 체크리스트→마일스톤 병합 (신규 DB에서는 데이터 이관이 no-op) ──────────
-- 0018: checklist_items를 milestones로 병합 (UUID 보존)
-- plan: docs/superpowers/plans/2026-08-22-merge-checklist-into-milestones.md
--
-- 검증 노트 (기존 마이그레이션 대조):
-- - handoffs FK 제약명은 0014에서 inline 정의되어 Postgres 자동 명명 규칙에 따라
--   `handoffs_checklist_item_id_fkey`로 생성됨 → 아래 drop constraint 이름과 일치
-- - 0012의 트리거/함수 이름(trg_sync_milestone_completion,
--   sync_milestone_completion(), recompute_milestone(uuid)) 확인 후 DROP
-- - checklist_items의 나머지 의존 객체(trg_checklist_updated, trg_audit_checklist_items,
--   RLS policy, checklist_items_milestone_id_fkey)는 drop table이 함께 정리
-- - milestones에는 touch_updated_at(0001)·audit_capture(0003) 트리거가 이미 존재 → 유지

begin;

-- 백업 (롤백 가능성 대비) — anon/authenticated 접근 차단(PostgREST 노출 방지)
create table public.checklist_items_backup_0018 as select * from public.checklist_items;
create table public.milestones_backup_0018 as select * from public.milestones;
revoke all on public.checklist_items_backup_0018 from anon, authenticated;
revoke all on public.milestones_backup_0018 from anon, authenticated;

-- 스키마 확장
alter table public.milestones
  add column if not exists priority text,
  add column if not exists source text;
alter table public.milestones
  add constraint milestones_priority_check check (priority in ('high','medium','low'));
alter table public.milestones alter column date drop not null;

-- 완료 자동 동기화 트리거 제거 (자식 테이블 소멸)
drop trigger if exists trg_sync_milestone_completion on public.checklist_items;
drop function if exists public.sync_milestone_completion();
drop function if exists public.recompute_milestone(uuid);

-- 체크리스트 항목 이관 (원래 UUID 유지 → handoffs FK 데이터 그대로 유효)
insert into public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order, priority, source, updated_at, deleted_at)
select ci.id,
       m.date,
       ci.content,
       ci.team_id,
       'deliverable',
       ci.completed,
       null::uuid[],
       ci.sort_order,
       ci.priority,
       ci.source,
       coalesce(ci.updated_at, now()),
       ci.deleted_at
from public.checklist_items ci
left join public.milestones_backup_0018 m on ci.milestone_id = m.id
on conflict (id) do nothing;

-- 인계 FK 재지향 (같은 UUID를 참조하므로 데이터 무변경)
alter table public.handoffs drop constraint if exists handoffs_checklist_item_id_fkey;
alter table public.handoffs rename column checklist_item_id to item_id;
alter table public.handoffs
  add constraint handoffs_item_id_fkey
  foreign key (item_id) references public.milestones(id) on delete set null;

-- 조회 빈도 대비 인덱스 (기존 idx_handoffs_due/completed와 동일 패턴)
create index if not exists idx_handoffs_item_id on public.handoffs(item_id);

-- 구 테이블 제거 (FK·트리거는 drop table이 함께 정리)
drop table public.checklist_items;

commit;

-- ────────── 0019 마일스톤 삽입 잠금 ──────────
-- 체크리스트(milestones) 신규 항목 추가 잠금
-- 배경: 2026-08-22 중복 5쌍 정리로 항목 수 확정. 새 항목 추가는 총괄의 직접 지시가 있을 때만 수행.
-- 기존 항목의 내용 수정(제목·기한·하위 내용)과 완료 체크는 계속 자유.

create table if not exists app_locks (
  key text primary key,
  locked boolean not null default true,
  note text
);

-- app_locks 는 익명 쓰기로부터 보호 (읽기만 허용 — 외부에서 잠금을 해제하는 것 방지)
alter table public.app_locks enable row level security;
create policy app_locks_open_read on public.app_locks for select using (true);

-- ⚠ 시드 전에는 잠금 해제 상태로 시작한다 — migrate:md 가 생성하는 시드(0005)가
-- milestones INSERT를 수행하기 때문. 시드 실행 후 맨 아래 "재잠금" 쿼리를 실행할 것.
insert into app_locks (key, locked, note)
values (
  'milestones_insert',
  false,
  '체크리스트 항목 추가 잠금. 해제: update app_locks set locked = false where key = ''milestones_insert'';'
)
on conflict (key) do nothing;

create or replace function block_milestones_insert() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from app_locks where key = 'milestones_insert' and locked) then
    raise exception 'CHECKLIST_LOCKED: 신규 체크리스트 항목 추가가 잠겨 있습니다 (app_locks.milestones_insert). 기존 항목의 수정·완료 체크는 가능합니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists milestones_insert_lock on milestones;
create trigger milestones_insert_lock before insert on milestones
for each row execute function block_milestones_insert();

-- ────────── 시드 후 재잠금 — migrate:md 시드(0005) 실행이 끝난 뒤 이 쿼리를 따로 실행 ──────────
-- update app_locks set locked = true where key = 'milestones_insert';
