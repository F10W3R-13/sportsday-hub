-- 0023: 연도 설정 DB화 — app_config 키-값 저장소
-- 배경: 연도 값(행사명·행사일 등)을 코드(lib/event-config.ts)에서 DB로 옮겨,
-- 코드 수정·재배포 없이 시즌 리셋 SQL만으로 앱에 올해 값이 반영되게 한다.
-- (온보딩 무코딩화 1단계 — 값은 AI-SEASON-RESET.md 절차로 UPSERT 된다.)
-- app_config가 비어 있으면 앱은 event-config.ts의 기본값(템플릿)으로 폴백한다.

BEGIN;

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
create policy "app_config_open_read"  on public.app_config for select using (true);
create policy "app_config_open_write" on public.app_config for insert with check (true);
create policy "app_config_open_edit"  on public.app_config for update using (true);
create policy "app_config_open_del"   on public.app_config for delete using (true);

-- 감사 트리거 없음 — audit_capture는 NEW.id를 참조하는데 app_config은 key가 PK라
-- 컬럼이 맞지 않아 오류 발생. app_config은 시즌 리셋 SQL로만 갱신되므로 감사 불필요.

COMMIT;
