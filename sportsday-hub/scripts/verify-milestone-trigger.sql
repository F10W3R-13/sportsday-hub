-- 마일스톤 완료 동기화 트리거 검증
-- spec: docs/superpowers/specs/2026-08-12-마일스톤-완료-DB트리거-design.md §8
--
-- 파괴 없음: 전체가 BEGIN ... ROLLBACK 안에서 동작. dev Supabase에서만 실행할 것.
-- 실행:  psql "$DATABASE_URL" -f sportsday-hub/scripts/verify-milestone-trigger.sql
--        또는 Supabase 대시보드 SQL 에디터에 붙여넣기.
-- 판정:  "PASS" NOTICE 5개가 모두 기대값과 일치하면 합격.

begin;

-- 직전 실행 잔류 방지(롤백 누락 시)
delete from public.checklist_items
  where id in ('22222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222223');
delete from public.milestones
  where id in ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333');

-- fixture: 자식 2개인 테스트 마일스톤(team_id는 nullable → null)
insert into public.milestones (id, date, title, completed)
values ('11111111-1111-1111-1111-111111111111', '2026-12-31', '[VERIFY] 트리거', false);

insert into public.checklist_items (id, milestone_id, content, completed, sort_order)
values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', '[VERIFY] 자식1', false, 1),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '[VERIFY] 자식2', false, 2);

-- ===== S1: 자식 전부 완료 → completed=true =====
update public.checklist_items set completed = true
  where id in ('22222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222222');
do $$ declare c boolean; begin
  select completed into c from public.milestones where id='11111111-1111-1111-1111-111111111111';
  if c is true then raise notice 'S1 PASS 전부완료 → true (기대=true)';
  else raise notice 'S1 FAIL 기대=true 실제=%', c; end if;
end $$;

-- ===== S2: 하나 해제 → 롤백 completed=false =====
update public.checklist_items set completed = false
  where id='22222222-2222-2222-2222-222222222221';
do $$ declare c boolean; begin
  select completed into c from public.milestones where id='11111111-1111-1111-1111-111111111111';
  if c is false then raise notice 'S2 PASS 하나해제 → false (기대=false)';
  else raise notice 'S2 FAIL 기대=false 실제=%', c; end if;
end $$;

-- ===== S3: 완료된 마일스톤 밑에 미완료 항목 추가 → 롤백 =====
update public.checklist_items set completed = true
  where id='22222222-2222-2222-2222-222222222221';  -- 다시 전부 완료 → milestone true
insert into public.checklist_items (id, milestone_id, content, completed, sort_order)
values ('22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111111','[VERIFY] 자식3(미완료)', false, 3);
do $$ declare c boolean; begin
  select completed into c from public.milestones where id='11111111-1111-1111-1111-111111111111';
  if c is false then raise notice 'S3 PASS 미완료추가 → 롤백 false (기대=false)';
  else raise notice 'S3 FAIL 기대=false 실제=%', c; end if;
end $$;

-- ===== S4: 마지막 미완료 항목 soft-delete → 자동 완료 =====
update public.checklist_items set deleted_at = now()
  where id='22222222-2222-2222-2222-222222222223';
do $$ declare c boolean; begin
  select completed into c from public.milestones where id='11111111-1111-1111-1111-111111111111';
  if c is true then raise notice 'S4 PASS 마지막미완료 soft-delete → true (기대=true)';
  else raise notice 'S4 FAIL 기대=true 실제=%', c; end if;
end $$;

-- ===== S5: 순수 마일스톤(자식 없음)은 recompute가 건드리지 않음 =====
insert into public.milestones (id, date, title, completed)
values ('33333333-3333-3333-3333-333333333333', '2026-12-31', '[VERIFY] 순수', false);
select public.recompute_milestone('33333333-3333-3333-3333-333333333333');  -- total=0 → noop
do $$ declare c boolean; begin
  select completed into c from public.milestones where id='33333333-3333-3333-3333-333333333333';
  if c is false then raise notice 'S5 PASS 순수마일스톤 noop (기대=false 유지)';
  else raise notice 'S5 FAIL 기대=false 실제=%', c; end if;
end $$;

-- (참고) milestone_id 이동(UPDATE로 마일스톤 변경)은 앱에 해당 mutation이 없으므로
-- 런타임 검증에서 제외. 트리거 함수의 OLD+NEW 처리는 코드 리뷰로 확인(spec §4-2).

rollback;
