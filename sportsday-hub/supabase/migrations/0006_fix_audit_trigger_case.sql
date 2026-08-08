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
