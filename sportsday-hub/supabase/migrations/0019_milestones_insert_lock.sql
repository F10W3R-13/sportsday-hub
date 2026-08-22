-- 체크리스트(milestones) 신규 항목 추가 잠금
-- 배경: 2026-08-22 중복 5쌍 정리로 항목 수 확정. 새 항목 추가는 총괄의 직접 지시가 있을 때만 수행.
-- 기존 항목의 내용 수정(제목·기한·하위 내용)과 완료 체크는 계속 자유.

create table if not exists app_locks (
  key text primary key,
  locked boolean not null default true,
  note text
);

insert into app_locks (key, locked, note)
values (
  'milestones_insert',
  true,
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
