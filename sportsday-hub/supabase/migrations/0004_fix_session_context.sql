-- C2 fix: set_user_context의 is_local을 false로 변경 (세션 스코프)
-- 기존 0003에서 true(트랜잭션 스코프)로 설정되어 있어 실제 쓰기 시점에는 사라지는 문제 해결.
-- false로 설정하면 세션 전체에서 유지되어 audit 트리거가 닉네임을 읽을 수 있음.
create or replace function public.set_user_context(p_nickname text)
returns void as $$
begin
  perform set_config('app.changed_by', coalesce(p_nickname, '익명'), false);
end;
$$ language plpgsql security definer;

-- C3 fix: 가이드라인 섹션 원자적 업데이트 RPC
-- 클라이언트에서 read-modify-write(전체 guideline_doc 덮어쓰기)를 하면
-- 동시 편집 시 데이터 유실이 발생하므로, 서버에서 JSONB를 원자적으로 갱신.
create or replace function public.update_guideline_section(
  p_team_id text,
  p_section_id text,
  p_content_md text
) returns void as $$
declare
  doc jsonb;
begin
  select guideline_doc into doc from public.teams where id = p_team_id;
  if doc is null then return; end if;

  doc := jsonb_set(
    doc,
    '{sections}',
    (
      select jsonb_agg(
        case
          when (s->>'id') = p_section_id
          then jsonb_set(s, '{content_md}', to_jsonb(p_content_md))
          else s
        end
      )
      from jsonb_array_elements(doc->'sections') as s
    )
  );

  update public.teams set guideline_doc = doc where id = p_team_id;
end;
$$ language plpgsql security definer;
