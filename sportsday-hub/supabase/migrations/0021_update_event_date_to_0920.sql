-- 행사일 확정: 2026-09-19(토) → 2026-09-20(일)
--
-- 0005 시드가 넣은 'Sports Day' 마일스톤 날짜와 기획관리팀 지침 문서(guideline_doc)
-- 속 행사일 표기를 9/20(일)로 교정한다. 이미 적용된 0005은 수정하지 않는다
-- (마이그레이션 체크섬 보존 — 본 파일이 이후 시점에 값을 덮어쓴다).

begin;

-- 1) Sports Day 마일스톤 날짜 (전체 공통 + 기획관리팀 개별 2건)
update public.milestones
   set date = '2026-09-20'::date
 where title = 'Sports Day'
   and date = '2026-09-19'::date;

-- 2) 지침 문서 내 행사일 표기 (해당 패턴이 있는 팀에만 적용)
update public.teams
   set guideline_doc = replace(
         replace(
           replace(guideline_doc::text,
             '2026년 9월 19일 (토)', '2026년 9월 20일 (일)'),
           '26-2는 9/19(토), 25-2는 9/20(토)로', '26-2는 9/20(일), 25-2는 9/20(토)로'),
         '25-2(9/20)와 26-2(9/19)는', '25-2(9/20)와 26-2(9/20)는')::jsonb
 where guideline_doc is not null
   and (guideline_doc::text like '%9/19%' or guideline_doc::text like '%9월 19일%');

commit;
