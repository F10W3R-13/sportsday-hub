-- 26-2 스포츠데이 허브 초기 스키마

-- extensions
create extension if not exists "uuid-ossp";

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
  id          uuid primary key default uuid_generate_v4(),
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
  id          uuid primary key default uuid_generate_v4(),
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
  id          uuid primary key default uuid_generate_v4(),
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
