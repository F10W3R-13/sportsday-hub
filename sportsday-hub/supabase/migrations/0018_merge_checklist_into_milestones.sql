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
