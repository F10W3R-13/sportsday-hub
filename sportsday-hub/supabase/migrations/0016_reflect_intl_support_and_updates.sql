-- 0016: 국제처 지원 확정 + 하클 모집 방식 변경 + 구글폼 문항 구조 반영
-- 출처: 여러 톡방 카톡 내용 종합 (2026-08-21 정리)
--   1) 국제처 지원 안내: 천막 대여 · First Aid 섭외 · 율전 편도 버스 2대 ·
--      하이클럽 식사(인당 약 5천원) [기존 지원 유지]
--      + 하이클럽 티셔츠 · 교환학생 티셔츠(인당 만원까지) [신규 지원]
--      → 예산 여유 생김. 단체티 제작·예산안 작성 시 반영 요청
--   2) 타임라인팀: 하클 가용인원 조사를 진행하지 않고, 인사부장이 참/불참으로 먼저 모집한 후
--      버스 탑승 인원을 추후 모집하는 방식으로 변경
--   3) 교환팀 구글폼 초안(8/17 전정민): 성별 문항 3번으로 추가(male/female/prefer not to say),
--      신체적 불편·식품 문항은 소문항 형태로 제작(건너뛰기 문항 번호 혼선 방지)
--      → 기존 "폼 N번" 참조 무효화, 집계 항목 문항 참조 정리
--   4) 카드뉴스 홍보부 인계물(8/18 업로드, 8/19 피드백 반영 완료): 이미 앱에 반영돼 있어 확인만 함

BEGIN;

-- ===== 결정 추적표 =====

-- 신규: 국제처 지원 범위 (확정)
INSERT INTO public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes)
VALUES (
  'D8',
  '국제처 지원 범위',
  ARRAY['기존 지원만','기존 지원 + 단체티 지원']::text[],
  'confirmed',
  '천막 대여 · First Aid 섭외 · 율전 편도 버스 2대 · 하이클럽 식사(인당 약 5천원) + 하이클럽티·교환학생티(인당 만원까지)',
  '2026-08-21'::date,
  7,
  '국제처 안내 전달분(8/21 카톡). 예산 여유 — 단체티 제작·예산안 작성 시 지원 반영'
) ON CONFLICT (id) DO NOTHING;

-- 천막·First Aid·우천 대비(UI 추가분): 국제처 지원 확정으로 닫음
UPDATE public.decisions SET
  status = 'confirmed',
  current_value = '국제처 지원 확정(8/21) — 천막 대여·First Aid 섭외 포함 (D8 참조)',
  decision_date = '2026-08-21'::date
  WHERE id = 'a6e824b8-5fb6-42e0-8308-afadad49a62f';

-- D6 단체티: 국제처 티셔츠 지원 팩트 병합
UPDATE public.decisions SET
  current_value = '시안 확정. 앞면 로고 복잡(업체 거부 가능성) → 대안 로고 수렴 중. 8/16 업체 컨택 예정 · 국제처 단체티 지원 확정(8/21): 인당 만원까지'
  WHERE id = 'D6';

-- ===== 예산팀 =====
-- 예산안 작성에 지원 반영 명시
UPDATE public.checklist_items SET source = '국제처 지원(D8) 반영: 천막·First Aid·버스 2대·식사 5천원/인·단체티 1만원/인'
  WHERE id = '414bb4aa-2fbc-4c4e-b9e1-179c45557e20';

-- ===== 타임라인팀 =====
-- 하클 가용인원 조사 방식 변경: 인사부장 주관 2단계 모집
UPDATE public.milestones SET title = '하클 가용인원 파악 (인사부장 참/불참 선모집 → 버스 탑승 인원 후속 모집)'
  WHERE id = 'd98d89c3-50e8-4d85-a765-bd327d284199';

UPDATE public.checklist_items SET
  content = '하클 가용인원 파악 (인사부장 주관 — 타임라인은 결과 수령)',
  source = '변경(8/21 카톡): 타임라인팀 조사 폐지 — 인사붘이 참/불참 먼저 모집, 버스 탑승 인원은 추후 모집'
  WHERE id = '9f201b9c-46f0-407c-a5c7-a150fe470c84';

-- ===== 교환담당팀 =====
-- 구글폼 문항 구조 변경(8/17 초안)으로 집계 항목의 문항 번호 참조 정리
UPDATE public.checklist_items SET content = '성비 집계 (구글폼 3번 성별 항목 — male/female/prefer not to say)'
  WHERE id = 'f716dda2-d0d5-4335-85bd-1a5d8b9f511d';

UPDATE public.checklist_items SET content = '식이제한별 집계 (도시락/비건·할랄/알러지 — 폼 식이 문항·소문항)'
  WHERE id = 'b58bc9f3-2aae-4c8a-b77a-e8704cb1f2f0';

UPDATE public.checklist_items SET content = '티셔츠 사이즈별 집계 (S~3XL)'
  WHERE id = '965735fe-77ff-4108-aa96-12aeeb5b37c4';

UPDATE public.checklist_items SET content = '지인 요청 매칭 정리 ("함께할 친구 이름" 문항)'
  WHERE id = 'b57b4846-10e6-4bc1-b992-25131aa08431';

-- 구글폼 제작 항목에 초안 설계 근거 남기기
UPDATE public.checklist_items SET source = '8/17 초안: 성별 3번 문항 추가(male/female/prefer not to say), 불편·식품은 소문항 형태(번호 혼선 방지)'
  WHERE id = '62a66789-14d7-4116-833d-edbaeff224f0';

COMMIT;
