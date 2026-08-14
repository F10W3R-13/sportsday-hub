-- 0011: 2차 회의(8/9) 체크리스트 완료 처리 — 마일스톤 자동완료 조건 충족
-- 회의록: 26-2 Sports Day/스포츠데이 기획팀 2차 회의록.md
-- 0010이 이미 적용된 상태에서 체크리스트 완료 처리가 추가로 필요해져 별도 마이그레이션으로 분리.
-- (이미 적용된 0010을 수정하면 운영 DB에는 재실행되지 않고 환경 간 드리프트가 발생하므로
--  새 파일로 작성 — 마이그레이션 불변성 원칙)
-- 대상: 05e80dca(8/9 2차 회의) 마일스톤의 하위 체크리스트 5건
-- 회의록 근거:
--   content - 게임 12종 선정 완료(메인2/토너먼트4/미니6), 컨셉·팀 개수는 1차에서 확정
--   budget  - 점심 메뉴 선정 완료, 단체티 시안 확정, 신규 제작 전제, 리드타임 확인

BEGIN;

-- content: 컨셉·팀 개수 수령 (1차 확정, 2차 회의에서도 확인)
UPDATE public.checklist_items SET completed = true
  WHERE id = '939f0e15-b48b-4ca6-bdc5-b38428319f56';

-- budget: 8/9 회의에서 확인한 주문처(탑앤탑) 리드타임
UPDATE public.checklist_items SET completed = true
  WHERE id = 'e06dc6cf-b0d7-4bc0-b357-7232e1bd84f6';

-- budget: 단체티 방침(신규 제작 전제) + 주문처 리드타임 확인
UPDATE public.checklist_items SET completed = true
  WHERE id = '92ce63d1-cfab-47f9-82b1-b72749864bf2';

-- budget: 점심 메뉴 방향 논의 → 선정 완료로 승격
-- 회의록: "논비건 한식 도시락·돈치스팸 도시락, 비건 서브웨이 배지 선정"
UPDATE public.checklist_items SET completed = true
  WHERE id = 'cf501751-29c6-498f-b584-2a51e61de9c9';

-- budget: 시안(컨셉 연동) → 단체티 디자인 시안 확정
-- 회의록: "디자인 시안은 확정되었다"
UPDATE public.checklist_items SET completed = true
  WHERE id = '1bbdb684-4faa-4257-8648-2aea30eb1986';

-- 참고: 25897d0b(신규 제작 전제)는 이미 completed=true 상태였음 (seed에서 true)
--
-- 미반영 항목 (회의록에 완료 근거 없어 미완료 유지):
--   - content 21f56dac 점수배분 체계 확정: 잠정 합의일 뿐 확정 아님 (메인-토너먼트 차별성 추가 협의 중)
--   - content f6429af2/1630a01e/56a4eab9 (토너먼트/메인/미니 확정): 이미 완료 상태 (8/16 마일스톤)
--   - exchange 62a66789/141408e8 구글폼 제작·완성: "제작중. 미완"
--   - exchange eddbd511 카드뉴스 인계물 제작: "오늘부터 제작 시작" (착수, 미완)
--   - timeline 4712bc8b 전체 타임라인 완성: "8/16 컨텐츠팀과 소통 후 최종본 완성" (뼈대만, 미완)

COMMIT;
