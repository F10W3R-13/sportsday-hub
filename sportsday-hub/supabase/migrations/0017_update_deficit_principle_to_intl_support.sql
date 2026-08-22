-- 0017: 지침 원칙 갱신 — "적자 구조 전제" → "국제처 지원 전제" (8/21 국제처 안내 반영)
-- 대상: teams.guideline_doc jsonb 내 3개 섹션
--   - management: 적자-구조를-전제로-기획한다 (전역 원칙)
--   - budget: 1-적자-구조-전제-하이클럽-보전-없이는-성립-안-함
--   - budget: 2-단체티는-신규-제작-전제 (지원 한도 참고 추가)
-- 원본 마크다운(content-source/00_기획지침_마스터.md, content-source/teams/budget.md)도
-- 동일하게 수정해 둠. migrate:md 재실행은 시드 드리프트가 커서 하지 않았다(0016 참고).

BEGIN;

-- ===== management 전역 원칙 =====
UPDATE public.teams
SET guideline_doc = jsonb_set(
  guideline_doc,
  '{sections}',
  (
    SELECT jsonb_agg(
      CASE WHEN s->>'id' = '적자-구조를-전제로-기획한다'
           THEN s || jsonb_build_object(
             'title', '국제처 지원을 전제로 기획한다',
             'content_md', $md$## 🎯 국제처 지원을 전제로 기획한다
**원칙.** 국제처 지원 확정분(8/21 안내)을 예산·운영의 전제로 반영한다: 천막 대여 · First Aid 섭외 · 율전 편도 버스 2대 · 하이클럽 식사(인당 약 5천원) · 하이클럽/교환학생 단체티(인당 만원까지).

왜: 기존 "적자 구조 전제" 원칙의 주요 원인이었던 천막(25-2 기준 55만원)과 단체티 비용이 지원으로 예산 外가 됐다. 다만 티 지원은 인당 만원 한도라 단가 초과분(탑앤탑 12,400원 기준 약 2,400원/인)과 게임용품 등 기타 지출은 여전히 하이클럽 보전 가능성을 열어둔다.
참고: 웹앱 결정 D4(입장료) / D6(단체티) / D8(국제처 지원 범위)$md$)
           ELSE s END
      ORDER BY ord)
    FROM jsonb_array_elements(guideline_doc->'sections') WITH ORDINALITY AS t(s, ord)
  )
)
WHERE id = 'management';

-- ===== budget 팀 지침 — 적자 구조 섹션 =====
UPDATE public.teams
SET guideline_doc = jsonb_set(
  guideline_doc,
  '{sections}',
  (
    SELECT jsonb_agg(
      CASE WHEN s->>'id' = '1-적자-구조-전제-하이클럽-보전-없이는-성립-안-함'
           THEN s || jsonb_build_object(
             'title', '국제처 지원 전제 — 초과분·기타 지출만 보전 검토',
             'content_md', $md$## 🎯 국제처 지원 전제 — 초과분·기타 지출만 보전 검토
**원칙.** 예산안은 국제처 지원 확정분(8/21: 천막 대여 · First Aid 섭외 · 율전 편도 버스 2대 · 하이클럽 식사 인당 약 5천원 · 단체티 인당 만원까지)을 차감한 **순지출 기준**으로 작성한다.

왜: 과거 "적자 불가피" 전제의 근거였던 천막(25-2 기준 55만원)·단체티가 지원으로 예산 外가 됐다. 25-2는 국제처 지원 2,412,200원에도 부족분 475,320원(하이클럽 보전)이 났다 — 이번엔 지원 범위가 더 넓어 적자 폭이 크게 줄지만, 티 단가 초과분(약 2,400원/인)과 게임용품 등 기타 지출은 여전히 하이클럽 보전 가능성을 열어둔다.
참고: 웹앱 결정 D4 / D8 / [25-2 예산안](../25 스포츠데이 참고용 자료/[2025_Fall_Sports Day] 최종기획안 및 인원관리표.xlsx)$md$)
           ELSE s END
      ORDER BY ord)
    FROM jsonb_array_elements(guideline_doc->'sections') WITH ORDINALITY AS t(s, ord)
  )
)
WHERE id = 'budget';

-- ===== budget 팀 지침 — 단체티 신규 제작 섹션 (지원 한도 참고 추가) =====
UPDATE public.teams
SET guideline_doc = jsonb_set(
  guideline_doc,
  '{sections}',
  (
    SELECT jsonb_agg(
      CASE WHEN s->>'id' = '2-단체티는-신규-제작-전제'
           THEN s || jsonb_build_object(
             'content_md', $md$## 🎯 단체티는 신규 제작 전제
**원칙.** 단체티는 **신규 제작을 전제**로 기획한다.

왜: 컨셉이 인사이드아웃으로 바뀌어 도안도 새로 필요하다.
참고: 웹앱 결정 D6 / 25-2 기준(신규 158장, 탑앤탑 단가 12,400원, 총액 2,063,200원) / 8/21 국제처 지원 확정 — 인당 만원까지 (초과분 약 2,400원/인은 하이클럽 부담)$md$)
           ELSE s END
      ORDER BY ord)
    FROM jsonb_array_elements(guideline_doc->'sections') WITH ORDINALITY AS t(s, ord)
  )
)
WHERE id = 'budget';

COMMIT;
