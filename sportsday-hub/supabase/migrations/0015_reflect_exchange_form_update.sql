-- 0015: 교환담당팀 카톡 보고(2026-08-21) 반영
-- 원문 요지:
--   1) 타 부서에서 받은 내용(날짜 수정, 상세 스케줄 기입 등)을 반영해 교환팀 드라이브의
--      구글폼 업데이트 완료 — 입장료 외 내용은 모두 완성
--   2) 입장료는 예산팀 최종 확정 전 → 작년 2학기(25-2) 기준이자 현재 가장 많이 논의되는
--      15,000원으로 임시 기재. 확정 후 폼의 입장료 부분만 수정하면 됨
--
-- 참고: 운영 DB는 앱 UI에서 먼저 편집되어 시드과 드리프트가 있었다
--       (양식 확보·출석부 확보·폼 제작은 이미 완료, D4는 3차 회의 반영으로 이미 discussing).
--       아래 UPDATE들은 멱등하므로 어느 상태에서 실행해도 안전하다.
-- 0010/0011과 동일하게 영구 기록으로 남긴다.

BEGIN;

-- ===== 체크리스트 완료 처리 (8/20 구글폼 완성 마일스톤 하위) =====

-- 구글폼 완성: 이번 보고의 핵심 — "입장료 외의 내용은 모두 완성"
-- 이 UPDATE로 하위 4건이 모두 완료 → 트리거(0012)가 마일스톤 b3b447fa를 자동 완료 처리
UPDATE public.checklist_items SET
  completed = true,
  source = '교환담당팀 카톡(8/21): 날짜·상세 스케줄 반영해 폼 업데이트 완료 — 입장료 외 모두 완성'
  WHERE id = '141408e8-c597-4619-9d96-ab441a7f2b89';

-- 아래 3건은 운영 DB에서 이미 완료. 시드만으로 재구성한 환경 대비 멱등 유지용.
UPDATE public.checklist_items SET completed = true
  WHERE id = '62a66789-14d7-4116-833d-edbaeff224f0';  -- 구글폼 제작

UPDATE public.checklist_items SET completed = true
  WHERE id = 'c73063da-9b99-4d4a-9f4a-3f4f2146ba70';  -- 25-2 양식 확보

UPDATE public.checklist_items SET completed = true
  WHERE id = '3a893f46-92ef-4b46-8f71-33cce84507f1';  -- 26-1 출석부·피드백 확보

-- 미반영 항목 (보고에 완료 근거 없어 미완료 유지):
--   - exchange f37c19d3 구글폼 배포: 드라이브 업데이트까지만 보고, 교환학생 대상 배포 보고 없음

-- ===== 후속 작업 추가 (1건): 입장료 확정 후 폼 수정 =====
INSERT INTO public.checklist_items (id, team_id, milestone_id, content, priority, completed, source, sort_order)
VALUES (
  'd35f843b-40c0-46f5-a0c7-b7d01733093b',
  'exchange',
  '313c6967-1b39-4ae2-9170-efbec25a491d',  -- 8/25 최종기획안 완성 (입장료 결정 창 8/16~8/25)
  '입장료 확정 후 구글폼 입장료 금액 수정 (현재 15,000원 임시 기재)',
  'high',
  false,
  '교환담당팀 카톡(8/21): 예산팀 확정 전 — 폼에는 15,000원 기재됨',
  29
) ON CONFLICT (id) DO NOTHING;

-- ===== 결정 추적표 갱신 (D4 입장료) =====
-- status는 이미 discussing(3차 회의 반영) 유지. 이번 보고 사실을 current_value·notes에 병합.
UPDATE public.decisions SET
  current_value = '한도 파악됨 — 예상 티켓비 15,000원 · 약 100만원 적자까지 감내 가능(3차 회의) · 8/25까지 최종 결정 · 구글폼에 15,000원 임시 기재(8/21)',
  notes = '25-2 기준 1.5만원 (가이드라인: 1학기 1.3만). 교환담당팀 카톡(8/21): 폼 완성 보고 — 확정 후 폼의 입장료 부분만 수정'
  WHERE id = 'D4';

-- 예산팀 입장료 결정 항목에 폼 의존성 명시
UPDATE public.checklist_items SET source = '교환팀 구글폼에 15,000원 임시 기재됨 — 확정 시 폼 수정 필요'
  WHERE id = '12ddc088-5491-4729-941f-180bfa96a336';

COMMIT;
