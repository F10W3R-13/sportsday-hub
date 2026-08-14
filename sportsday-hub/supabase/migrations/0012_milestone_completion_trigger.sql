-- 0012: 마일스톤 completed 자동동기화를 DB 트리거로 이관
-- spec: docs/superpowers/specs/2026-08-12-마일스톤-완료-DB트리거-design.md
-- 기존 클라이언트(lib/milestone-sync.ts)를 대체 — 모든 checklist_items 쓰기 경로를
-- 트랜잭션 단위로 커버. 동작은 기존과 동일(책임만 이관).

BEGIN;

-- ===== (1) 핵심 재계산 로직 — 1개 마일스톤 completed를 현재 자식 상태 기준으로 갱신 =====
-- 트리거·백필·디버그가 공유. security definer로 호출자 RLS와 무관하게 DB 불변조건 유지.
create or replace function public.recompute_milestone(p_id uuid)
returns void as $$
declare
  total int;
  done int;
  cur_completed boolean;
begin
  -- 자식 체크리스트(soft-delete 제외) 집계
  select count(*), count(*) filter (where completed)
    into total, done
    from public.checklist_items
    where milestone_id = p_id
      and deleted_at is null;

  -- 현재 마일스톤 completed
  select completed into cur_completed
    from public.milestones
    where id = p_id;
  if not found then
    return;  -- 마일스톤이 없으면(삭제됨) noop
  end if;

  -- 순수 마일스톤(자식 없음) = 사용자 직접 관리 → 건드리지 않음
  if total = 0 then
    return;
  end if;

  -- 멱등: 실제로 바뀔 때만 UPDATE
  if done = total then
    if coalesce(cur_completed, false) is false then
      update public.milestones set completed = true where id = p_id;
    end if;
  else
    if coalesce(cur_completed, false) is true then
      update public.milestones set completed = false where id = p_id;
    end if;
  end if;
end;
$$ language plpgsql
  security definer
  set search_path = public, pg_temp;

-- ===== (2) 트리거 함수 — NEW/OLD에서 영향받은 마일스톤 추출해 recompute 호출(중복제거) =====
create or replace function public.sync_milestone_completion()
returns trigger as $$
begin
  -- UPDATE/DELETE: OLD.milestone_id
  if tg_op in ('UPDATE','DELETE') and old.milestone_id is not null then
    perform public.recompute_milestone(old.milestone_id);
  end if;

  -- INSERT/UPDATE: NEW.milestone_id (UPDATE이고 OLD와 같으면 위에서 처리했으므로 skip)
  if tg_op in ('INSERT','UPDATE') and new.milestone_id is not null then
    if not (tg_op = 'UPDATE' and old.milestone_id is not distinct from new.milestone_id) then
      perform public.recompute_milestone(new.milestone_id);
    end if;
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql;

-- ===== (3) 트리거 부착 (재실행 안전) =====
drop trigger if exists trg_sync_milestone_completion on public.checklist_items;
create trigger trg_sync_milestone_completion
  after insert or update or delete on public.checklist_items
  for each row execute function public.sync_milestone_completion();

-- ===== (4) 1회성 백필 — 현재 checklist 상태 기준으로 모든 마일스톤 재동기화 =====
-- 과거 클라이언트 sync가 놓친 부정합(trash-view류) 보정 → 트리거가 깨끗한 기저에서 시작.
-- milestones 직접 UPDATE이므로 checklist 트리거는 발화하지 않음.
select public.recompute_milestone(id) from public.milestones where deleted_at is null;

COMMIT;
