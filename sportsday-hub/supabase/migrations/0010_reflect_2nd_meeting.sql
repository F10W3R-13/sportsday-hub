-- 0010: 2차 회의(2026-08-09 22:00) 결과 반영
-- 회의록: 26-2 Sports Day/스포츠데이 기획팀 2차 회의록.md
-- 이 마이그레이션은 앱 UI에서도 동일하게 편집 가능하지만, 시드 데이터와의
-- 일관성을 위해 영구 기록으로 남긴다.

BEGIN;

-- ===== 마일스톤 완료 처리 (3건) =====
-- 2차 회의는 22:00에 종료됨
UPDATE public.milestones SET completed = true
  WHERE id = '05e80dca-3781-4386-b44a-65e590be03d0';  -- 8/9 기획팀 2차 회의

-- 컨텐츠팀: 게임 12종 선정 완료 (메인2/토너먼트4/미니6)
UPDATE public.milestones SET completed = true
  WHERE id = '6d445bf1-fb29-4e97-90c9-319c81806433';  -- 8/9 컨텐츠 방향성 뼈대

-- 예산팀: 점심 메뉴 선정 + 단체티 시안 확정 (방향 결정)
UPDATE public.milestones SET completed = true
  WHERE id = '11e1561a-c9d9-4fb4-bda8-bbb27d83a413';  -- 8/9 예산 방향 옵션

-- ===== 결정 추적표 갱신 (3건) =====

-- D5 점심 메뉴: 선정 완료 → confirmed
-- 회의록: "논비건 한식 도시락·돈치스팸 도시락, 비건 서브웨이 배지 선정"
UPDATE public.decisions SET
  status = 'confirmed',
  current_value = '한식 도시락·돈치스팸 도시락(논비건) + 서브웨이 배지(비건)',
  decision_date = '2026-08-09'::date
  WHERE id = 'D5';

-- D6 단체티: 디자인 시안 확정, 업체 컨택 진행 중 → discussing 유지 (업체 거부 가능성)
-- 회의록: "디자인 시안 확정, 앞면 로고 복잡해 업체 거부 가능성, 대안 로고 수렴 중, 8/16까지 컨택"
UPDATE public.decisions SET
  current_value = '시안 확정. 앞면 로고 복잡(업체 거부 가능성) → 대안 로고 수렴 중. 8/16 업체 컨택 예정'
  WHERE id = 'D6';

-- D7 점수 배분 체계: 6팀 차등 배점 잠정 결정, 메인/토너먼트 차별성 추가 협의 → discussing
-- 회의록: "1등100/2등80/3등60/4등40/5등20/6등10. 메인-토너먼트 차별성 추가 협의 중"
UPDATE public.decisions SET
  status = 'discussing',
  current_value = '잠정: 100/80/60/40/20/10 (6팀). 메인-토너먼트 점수 차별성 추가 협의 중',
  notes = '작년 5팀: 100/80/60/40/40 → 올해 6팀 기준 재설계'
  WHERE id = 'D7';

COMMIT;
