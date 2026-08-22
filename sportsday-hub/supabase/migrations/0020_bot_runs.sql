-- 단체방 봇(PC 스크립트) 실행 보고 기록 — watchdog이 '오늘 보고 없음'을 감지하는 근거.
create table if not exists public.bot_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  status text not null check (status in ('success', 'fail')),
  detail text,
  created_at timestamptz not null default now()
);

alter table public.bot_runs enable row level security;

create index if not exists bot_runs_run_date_idx on public.bot_runs (run_date);
