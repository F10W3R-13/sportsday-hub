-- 0013: 전체 팀 파일 피드 — 신규/수정 구분용 created_time 캡처
-- 기존 행은 null로 시작, 다음 동기화 upsert 시 값이 채워진다.
BEGIN;

alter table public.drive_files
  add column if not exists created_time timestamptz;

COMMIT;
