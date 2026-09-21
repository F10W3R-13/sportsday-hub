# AI 시즌 리셋 절차서 (AI 에이전트용)

> **후계자 사용법**: 이 파일과 함께 **올해 시즌 드라이브 폴더 링크**를 AI 에이전트에게 주고
> "이 절차서를 읽고 시즌 리셋을 수행해줘"라고 말하면 된다.
> 그 외에 아무것도 설명하지 않아도 되도록 이 문서가 전부를 담는다.

**올해 시즌 드라이브 폴더**: `<여기에 올해 폴더 링크>` ← 시즌 시작 시 채우는 칸

---

## 0. 역할과 안전 규칙 (AI가 반드시 먼저 읽을 것)

너(AI)는 스포츠데이 기획 허브의 **시즌 데이터를 DB에 반영하는 역할**이다.

1. **데이터베이스에 직접 접속하지 않는다.** 너의 산출물은 SQL 파일뿐이고,
   그 SQL을 사람이 Supabase 대시보드에서 붙여넣어 실행한다(휴먼-인-더-루프).
   어떤 자격증명·키도 요구하거나 받지 마라.
2. 저장소의 `HANDOVER/양식/표준양식_규격.md` 를 먼저 읽어 문서 규격을 이해하라.
3. 확실하지 않은 값은 **추측해서 넣지 말고** `<확인 필요: ...>` 주석으로 남기고
   사람에게 물어보라. 특히 사람 이름.
4. 실명 오타가 이 시스템의 역사적 최대 사고 원인이다(26-2: 이강서↔유주영 3곳 오기).
   **모든 이름을 원본 문서 간 교차 대조**하라: 최종기획안 시트2 ↔ 마스터 지침 ↔ 회의록.
   한 글자만 다른 이름 쌍이 있으면 반드시 사람에게 확인 요청.

## 1. 입력 읽기

올해 시즌 폴더에서 다음을 읽는다 (규격·열 체계는 표준양식_규격.md):

| 파일 | 읽을 것 |
|---|---|
| 최종기획안 시트1(기획안) | 행사명/테마, 일시(→YYYY-MM-DD), 학기, 핵심 결정 |
| 최종기획안 시트2(배치표) | (1단계에선 참고용 — 앱 반영은 2단계) |
| 00_기획지침_마스터.md | 결정 추적표 → decisions, 회의·산출물 일정 → milestones, 이슈 로그 → issues, 전체 지침 |
| 팀 하위폴더의 팀 지침 | 팀별 이름·색·아이콘·미션(teams 표시 속성) |

팀 id는 고정 슬러그를 쓴다(앱 코드 어휘와 1:1):
`management`(기획관리) · `content`(컨텐츠) · `budget`(예산) · `exchange`(교환) · `timeline`(타임라인/인원관리).
폴더명이 달라도 역할로 매핑하라.

## 2. 파싱 품질 규칙

- 날짜: `3/5` → `2027-03-05` (올해 연도 사용). 회의 일정 항목에 괄호 날짜가 없으면
  그 항목은 milestones에서 **건너뛰고** 요약에 "날짜 없음"으로 알린다.
- 결정 상태: `🟢확정: X` → status='confirmed', current_value='X' · `🟡방향/논의` → 'discussing' ·
  `🔴미정` → 'pending' · `⚪보류` → 'deferred'.
- 산출물 담당 팀명(예산/컨텐츠/교환/타임라인/기획관리/전체)은 위 슬러그로 매핑.
- 마일스톤 id: 확정 D번호는 그대로(D1~), 일정 항목은 `m-<slug>-<n>` 식의 안정 id 생성.
- 중복 판정: 같은 회의가 회의록·마스터에 모두 있으면 마스터(최신본) 기준 1건.
- **이름 집합 검증**: 문서 전체에서 등장한 인명 집합을 만들어, 최종기획안과 1글자 차이 나는
  이름이 있으면 시트 원본 셀을 다시 확인하고 사람에게 보고하라.

## 3. 산출물 — season_reset.sql

아래 템플릿을 채워 **하나의 완전한 SQL 파일**을 만든다. `<...>` 부분이 네가 채우는 자리.
SQL 앞에 사람이 읽는 요약을 붙인다: 이번 시즌 개요(행사명·날짜·팀 수)와
반영될 건수(결정 N건·마일스톤 N건·이슈 N건), 건너뛴 항목과 이유.

```sql
-- ═══ 시즌 리셋: <행사명> (<학기>) — 생성: <날짜>, 생성자: AI 에이전트 ═══
-- 이 SQL이 하는 일: ①이전 시즌 백업 → ②연도 설정 → ③팀 → ④데이터 리셋+시드 → ⑤검증
-- 되돌리기: 실행 후 COMMIT 까지 왔다면 백업 테이블(archive_prev_*)에서 수동 복구 필요.

select set_user_context('시즌 리셋 <행사명>');

BEGIN;

-- ── 1) 이전 시즌 아카이브 (스키마 내 백업 — 다음 리셋 때 대체됨) ──
DROP TABLE IF EXISTS archive_prev_app_config, archive_prev_teams, archive_prev_decisions,
  archive_prev_milestones, archive_prev_issues, archive_prev_handoffs, archive_prev_drive_files;
CREATE TABLE archive_prev_app_config  AS SELECT * FROM app_config;
CREATE TABLE archive_prev_teams       AS SELECT * FROM teams;
CREATE TABLE archive_prev_decisions   AS SELECT * FROM decisions;
CREATE TABLE archive_prev_milestones  AS SELECT * FROM milestones;
CREATE TABLE archive_prev_issues      AS SELECT * FROM issues;
CREATE TABLE archive_prev_handoffs    AS SELECT * FROM handoffs;
CREATE TABLE archive_prev_drive_files AS SELECT * FROM drive_files;

-- ── 2) 연도 설정 (app_config) ──
INSERT INTO app_config (key, value) VALUES
  ('hub_title',       '<올해 허브 제목>'),
  ('event_name',      '<행사명, 예: 27-1 스포츠데이>'),
  ('semester_label',  '<예: 2027년 1학기>'),
  ('event_date_iso',  '<YYYY-MM-DD>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ── 3) 팀 (고정 5슬러그 · 표시속성은 올해 문서에서) ──
INSERT INTO teams (id, name, name_en, color, icon, sort_order, mission, guideline_doc) VALUES
  ('management', '<기획관리팀>', 'Management', '<hex>', '<lucide아이콘>', 0, '<미션>', '{"sections":[]}'::jsonb),
  ('content',    '<컨텐츠팀>',   'Content',    '<hex>', '<아이콘>', 1, '<미션>', '{"sections":[]}'::jsonb),
  ('budget',     '<예산팀>',     'Budget',     '<hex>', '<아이콘>', 2, '<미션>', '{"sections":[]}'::jsonb),
  ('exchange',   '<교환담당팀>', 'Exchange',   '<hex>', '<아이콘>', 3, '<미션>', '{"sections":[]}'::jsonb),
  ('timeline',   '<타임라인/인원관리팀>', 'Timeline', '<hex>', '<아이콘>', 4, '<미션>', '{"sections":[]}'::jsonb)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en,
  color=EXCLUDED.color, icon=EXCLUDED.icon, mission=EXCLUDED.mission,
  guideline_doc=EXCLUDED.guideline_doc, deleted_at=NULL;

-- ── 4) 시즌 데이터 리셋 ──
-- 마일스톤 신규 추가 잠금 해제(운영 정책: 시즌 중 UI에서 자유 추가 허용)
UPDATE app_locks SET locked = false WHERE key = 'milestones_insert';
DELETE FROM handoffs;
DELETE FROM drive_files;   -- 드라이브 연동 재동기화로 자동 재수집
DELETE FROM issues;
DELETE FROM milestones;
DELETE FROM decisions;

-- ── 5) 시드 ──
INSERT INTO decisions (id, title, options, status, current_value, decision_date, sort_order, notes) VALUES
  ('D1', '<결정 항목>', ARRAY['옵션1','옵션2'], 'confirmed', '<확정값>', '2027-03-05', 0, NULL);
  -- ...행 추가

INSERT INTO milestones (id, date, title, team_id, category, completed, depends_on, sort_order, priority, source) VALUES
  (gen_random_uuid(), '2027-03-05', '1차 회의', 'management', 'meeting', true, NULL, 0, NULL, '마스터 §4-1');
  -- ...행 추가 (id는 uuid 타입 — gen_random_uuid() 사용, 회의=meeting · 산출물=deliverable · 'Sports Day'당일=event)

INSERT INTO issues (id, team_id, date, title, status, notes) VALUES
  (gen_random_uuid(), NULL, '2027-03-10', '<이슈>', 'open', '<비고>');
  -- ...행 추가

-- ── 6) 검증 (실행 후 결과를 사람이 눈으로 확인) ──
SELECT 'teams' AS 테이블, count(*) AS 행수 FROM teams
UNION ALL SELECT 'app_config', count(*) FROM app_config
UNION ALL SELECT 'decisions', count(*) FROM decisions
UNION ALL SELECT 'milestones', count(*) FROM milestones
UNION ALL SELECT 'issues', count(*) FROM issues;
-- 기대: teams=5 · app_config=4 · decisions=<N> · milestones=<N> · issues=<N>
SELECT key, value FROM app_config ORDER BY key;  -- 올해 값 4줄 확인
SELECT category, count(*) FROM milestones GROUP BY category;  -- 구성 확인

COMMIT;
```

## 4. 사람이 할 일 (AI가 안내할 것)

1. Supabase 대시보드 → SQL Editor → 새 쿼리 → SQL 전체 붙여넣기 → **Run**
2. 맨 아래 검증 SELECT 결과가 기대치와 일치하는지 확인
3. 허브 사이트를 새로고침해 확인: 대시보드 제목·D-day·팀 카드 5장·결정 추적표
4. 좌측 하단 닉네임 설정 → 마일스톤 하나의 완료 체크로 쓰기 동작 확인

## 5. 연말 (다음 시즌으로 넘길 때)

같은 절차가 곧 연말이다 — 다음 시즌 리셋 SQL의 ①번 백업이 이 시즌의 아카이브가 된다.
추가로 연말에 사람이 할 일: 백업을 영구 보관하려면 Supabase 대시보드에서
각 테이블 CSV 내보내기 후 **드라이브 시즌 폴더**에 보관 (또는 저장소 archive에 도우미 커밋).
당일 배치·브리핑 산출물은 시즌 폴더에 이미 있으므로 별도 조작 불필요.

## 6. 실패했을 때

- **실행 중 오류로 일부만 됨**: 템플릿이 BEGIN~COMMIT로 묶여 있어 전부 롤백된다.
  오류 메시지를 AI에게 다시 주면 수정본을 낸다.
- **실행은 됐는데 이상**: `archive_prev_*` 테이블에 이전 데이터가 그대로 있으므로
  AI에게 "백업에서 복구하는 SQL"을 요청하면 된다.
- **앱이 안 바뀜**: 새로고침·시크릿창 확인 → 그래도 같으면 Supabase 프로젝트가
  절전 모드일 수 있음(대시보드에서 Restore) → HANDOVER/07_FAQ 참조.
