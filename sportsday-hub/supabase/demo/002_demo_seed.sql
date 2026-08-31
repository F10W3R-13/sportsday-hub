-- 데모 인스턴스 전용 시드 — 반드시 "데모 Supabase 프로젝트"에서만 실행할 것.
--
-- 개요: 마이그레이션(0005/0009/0010/0011 등)이 넣은 실제 데이터를 전부 비우고
-- 가상의 예시 데이터로 교체한다. 실명·예산·구글 드라이브 링크·실제 일정은
-- 어떤 형태로도 포함하지 않는다(채용용 데모의 비식별 원칙).
--
-- 실행 순서: 스키마 마이그레이션 전부 → 002_demo_seed.sql → 001_demo_readonly_rls.sql

begin;

-- 마일스톤 신규 삽입 잠금(0019)은 역할 무관하게 차단하므로 시딩 중에만 해제 후 복원
update public.app_locks set locked = false where key = 'milestones_insert';

-- ===== 기존(실제) 데이터 전부 제거 =====
-- checklist_items는 0018(체크리스트→마일스톤 병합)에서 삭제된 테이블 — 목록에서 제외
truncate public.drive_files, public.drive_tokens, public.bot_runs, public.audit_log,
               public.handoffs, public.issues, public.milestones,
               public.decisions restart identity cascade;
truncate public.teams cascade;

-- ===== 팀 (가상 예시, 실제 조직과 무관) =====
insert into public.teams (id, name, name_en, color, icon, sort_order, mission) values
  ('demo-planning',  '기획관리팀',   'Planning',       '#6366f1', '📋', 1, '행사 전체 구조와 일정을 관리합니다 (예시 데이터)'),
  ('demo-content',   '컨텐츠팀',     'Content',        '#ec4899', '🎨', 2, '오늘의 게임과 무대 프로그램을 만듭니다 (예시 데이터)'),
  ('demo-logistics', '물품·설치팀',  'Logistics',      '#f59e0b', '📦', 3, '물품 조달과 현장 설치를 담당합니다 (예시 데이터)'),
  ('demo-safety',    '안전지원팀',   'Safety',         '#10b981', '🛟', 4, '참가자 안전과 응급 대응을 준비합니다 (예시 데이터)'),
  ('demo-record',    '기록·홍보팀',  'Media',          '#3b82f6', '📸', 5, '행사 기록과 홍보 콘텐츠를 제작합니다 (예시 데이터)');

-- ===== 핵심 결정 (가상 — 금액·실제 지원 범위 없음) =====
insert into public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes) values
  ('demo-d1', '행사 컨셉 선정',      array['레트로 스포츠데이','미니 올림픽','동아리 축제'], 'confirmed',  '미니 올림픽', '2026-07-24', 1, '기획 회의에서 확정 (예시)'),
  ('demo-d2', '개막 행사 형식',      array['퍼레이드','카운트다운','공동 워밍업'],           'confirmed',  '공동 워밍업', '2026-07-31', 2, null),
  ('demo-d3', '대표 게임 5종',       array['릴레이','풋살','줄다리기','오목','퀴즈'],       'discussing', null,          null,        3, '팀별 의견 수렴 중 (예시)'),
  ('demo-d4', '우천 시 진행 계획',   array['실내 프로그램 전환','일정 연기'],               'pending',    null,          null,        4, null),
  ('demo-d5', '폐막 시상 형식',      array['전체 시상','팀별 시상'],                        'pending',    null,          null,        5, null);

-- ===== 마일스톤 (가상 일정 — 2026-09-01 기준: 전 팀 진행 중, 지연 1건 + 금일 마감 2건 포함) =====
insert into public.milestones (date, title, team_id, category, completed, sort_order) values
  ('2026-07-28', '전체 기획안 초안 작성',              'demo-planning',  'deliverable', true,  1),
  ('2026-08-04', '게임·규칙 구조 확정',                'demo-planning',  'deliverable', true,  2),
  ('2026-08-11', '게임 규칙집 초안',                   'demo-content',   'deliverable', true,  3),
  ('2026-08-18', '진행 스크립트 v1',                   'demo-content',   'deliverable', true,  4),
  ('2026-08-22', '응급 연락망 양식 공유',              'demo-safety',    'deliverable', true,  5),
  ('2026-08-25', '물품 견적 요청 발송',                'demo-logistics', 'deliverable', true,  6),
  ('2026-08-26', '촬영 장비 대여 확인',                'demo-record',    'deliverable', true,  7),
  ('2026-08-29', '스태프 배정표 확정',                 'demo-planning',  'deliverable', false, 8),
  ('2026-09-01', '안전 대응 매뉴얼 초안',              'demo-safety',    'deliverable', false, 9),
  ('2026-09-01', '홍보 포스터 시안 1차',               'demo-record',    'deliverable', false, 10),
  ('2026-09-08', '주간 기획 회의 (#5)',                'demo-planning',  'meeting',     false, 11),
  ('2026-09-10', '팀 간 인계물 초안 점검',             'demo-content',   'deliverable', false, 12),
  ('2026-09-14', '설치 리허설',                        'demo-logistics', 'event',       false, 13),
  ('2026-09-15', '행사 하이라이트 편집 플랜',          'demo-record',    'deliverable', false, 14),
  ('2026-09-16', '안전 대응 매뉴얼 리허설',            'demo-safety',    'event',       false, 15),
  ('2026-09-17', '최종 점검 회의',                     'demo-planning',  'meeting',     false, 16),
  ('2026-09-19', '행사 당일 (가상)',                   'demo-planning',  'event',       false, 17);

-- ===== 이슈 (가상) =====
insert into public.issues (team_id, date, title, status, notes) values
  ('demo-content',   '2026-09-01', '대표 게임 5종 확정 지연 — 차주 회의까지 의견 수렴 필요', 'in_progress', '결정 트래커 D3과 연동 (예시)'),
  ('demo-logistics', '2026-08-28', '일부 물품 리드타임 길어짐 — 대체 업체 검토',           'open',        null),
  ('demo-safety',    '2026-08-24', '응급 연락망 양식 초안 공유 완료',                      'resolved',    null);

-- ===== 인계 (가상) =====
insert into public.handoffs (from_team_id, to_team_id, to_external, title, due_date, completed, sort_order) values
  ('demo-planning', 'demo-content',   null,             '확정된 컨셉 브리프 전달',          '2026-07-31', true,  1),
  ('demo-content',  'demo-record',    null,             '게임 규칙집 홍보용 요약본',        '2026-09-02', false, 2),
  ('demo-planning', null,             '가상 협력업체',   '설치 지원 요청서',                '2026-09-08', false, 3),
  ('demo-safety',   'demo-planning',  null,             '안전 유의사항 스크립트 반영 요청', '2026-09-10', false, 4);

-- 시딩으로 쌓인 감사 로그 정리 + 삽입 잠금 복원
truncate public.audit_log;
update public.app_locks set locked = true where key = 'milestones_insert';

commit;

-- ===== 확인용 =====
-- select (select count(*) from teams) teams, (select count(*) from milestones) milestones,
--        (select count(*) from decisions) decisions, (select count(*) from handoffs) handoffs;
-- 기대값: teams=5, milestones=17, decisions=5, handoffs=4 (전 팀 완료 1건 이상)
