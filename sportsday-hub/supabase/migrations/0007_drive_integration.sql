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
