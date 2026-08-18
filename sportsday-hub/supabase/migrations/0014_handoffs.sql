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

-- ===== 초기 시드 5건 (기존 체크리스트 인계 항목에서 추출, 전부 미완료) =====
insert into public.handoffs
  (id, from_team_id, to_team_id, to_external, title, due_date, completed, checklist_item_id, sort_order)
values
  ('11111111-1111-4111-8111-111111111111', 'content',   'budget',   null,     '게임별 필요 인원·물품 리스트',      '2026-08-16', false, '728a5f1a-3033-48b4-8e3b-7f7ec74f16b1', 1),
  ('22222222-2222-4222-8222-222222222222', 'content',   'exchange', null,     '컨텐츠 안내 (카드뉴스용)',           null,          false, '8cc9ec56-98d1-4de3-8a94-d80d3b054e54', 2),
  ('33333333-3333-4333-8333-333333333333', 'exchange',  null,       '홍보부', '카드뉴스 홍보부 인계물 (1차)',      '2026-08-18', false, '40f95907-b1b2-43da-9a4d-3fe619c51d9f', 3),
  ('44444444-4444-4444-8444-444444444444', 'exchange',  null,       '홍보부', '카드뉴스 홍보부 인계물 (2차)',      '2026-08-30', false, '40f95907-b1b2-43da-9a4d-3fe619c51d9f', 4),
  ('55555555-5555-4555-8555-555555555555', 'exchange',  'timeline', null,     '버스 탑승 명단',                     null,          false, '902c4cc4-9307-4159-b3cf-09f4a1b2a4d4', 5);

COMMIT;
