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
