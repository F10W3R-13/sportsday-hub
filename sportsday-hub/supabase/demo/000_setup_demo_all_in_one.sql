-- ====================================================================
-- 스포츠데이 허브 — 데모 인스턴스 원클릭 설정 (2026-08-31 갱신)
-- 반드시 '새로 만든 데모 Supabase 프로젝트'에서만 실행할 것.
-- 내용: 스키마 마이그레이션 → 실제 데이터 제거+가상 시드 → 읽기전용 RLS
-- 순서 주의: 0006(audit 트리거 소문자 수정)을 0005(시드)보다 먼저 적용한다
--           (0005의 INSERT가 audit 트리거를 발생시켜 CHECK 위반 방지).
--           0006은 create or replace라 중복 적용이 무해하다.
-- 운영 프로젝트에서 실행하면 기획팀 데이터가 삭제되고 쓰기가 막힌다.
-- ====================================================================

-- ═══════════ 0001_init_schema.sql ═══════════
-- 26-2 스포츠데이 허브 초기 스키마

-- pgcrypto (gen_random_uuid)는 Supabase에 기본 활성화되어 있음

-- ===== teams =====
create table public.teams (
  id            text primary key,
  name          text not null,
  name_en       text not null,
  color         text not null,
  icon          text not null,
  sort_order    int not null,
  mission       text not null,
  guideline_doc jsonb not null default '{"sections":[]}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ===== decisions =====
create table public.decisions (
  id            text primary key,
  title         text not null,
  options       text[] not null default '{}',
  status        text not null default 'pending'
                  check (status in ('confirmed','discussing','pending','deferred')),
  current_value text,
  decision_date date,
  sort_order    int not null default 0,
  notes         text,
  updated_at    timestamptz not null default now()
);

-- ===== milestones =====
create table public.milestones (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  title       text not null,
  team_id     text references public.teams(id) on delete set null,
  category    text not null default 'deliverable'
                check (category in ('meeting','deliverable','event')),
  completed   boolean not null default false,
  depends_on  uuid[] default null,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

-- ===== checklist_items =====
create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  team_id     text references public.teams(id) on delete cascade,
  section     text not null default 'progress'
                check (section in ('progress','feedback','prep')),
  content     text not null,
  priority    text check (priority in ('high','medium','low')),
  completed   boolean not null default false,
  source      text,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

-- ===== issues =====
create table public.issues (
  id          uuid primary key default gen_random_uuid(),
  team_id     text references public.teams(id) on delete cascade,
  date        date,
  title       text not null,
  status      text not null default 'open'
                check (status in ('open','in_progress','resolved')),
  notes       text,
  updated_at  timestamptz not null default now()
);

-- ===== updated_at 자동 갱신 트리거 =====
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_teams_updated    before update on public.teams
  for each row execute function public.touch_updated_at();
create trigger trg_decisions_updated before update on public.decisions
  for each row execute function public.touch_updated_at();
create trigger trg_milestones_updated before update on public.milestones
  for each row execute function public.touch_updated_at();
create trigger trg_checklist_updated before update on public.checklist_items
  for each row execute function public.touch_updated_at();
create trigger trg_issues_updated   before update on public.issues
  for each row execute function public.touch_updated_at();

-- ═══════════ 0002_rls_policies.sql ═══════════
-- RLS 활성화 (열린 편집: anon 전권)
alter table public.teams           enable row level security;
alter table public.decisions       enable row level security;
alter table public.milestones      enable row level security;
alter table public.checklist_items enable row level security;
alter table public.issues          enable row level security;

-- ===== teams =====
create policy "teams_open_read"  on public.teams for select using (true);
create policy "teams_open_write" on public.teams for insert with check (true);
create policy "teams_open_edit"  on public.teams for update using (true);
create policy "teams_open_del"   on public.teams for delete using (true);

-- ===== decisions =====
create policy "decisions_open_read"  on public.decisions for select using (true);
create policy "decisions_open_write" on public.decisions for insert with check (true);
create policy "decisions_open_edit"  on public.decisions for update using (true);
create policy "decisions_open_del"   on public.decisions for delete using (true);

-- ===== milestones =====
create policy "milestones_open_read"  on public.milestones for select using (true);
create policy "milestones_open_write" on public.milestones for insert with check (true);
create policy "milestones_open_edit"  on public.milestones for update using (true);
create policy "milestones_open_del"   on public.milestones for delete using (true);

-- ===== checklist_items =====
create policy "checklist_open_read"  on public.checklist_items for select using (true);
create policy "checklist_open_write" on public.checklist_items for insert with check (true);
create policy "checklist_open_edit"  on public.checklist_items for update using (true);
create policy "checklist_open_del"   on public.checklist_items for delete using (true);

-- ===== issues =====
create policy "issues_open_read"  on public.issues for select using (true);
create policy "issues_open_write" on public.issues for insert with check (true);
create policy "issues_open_edit"  on public.issues for update using (true);
create policy "issues_open_del"   on public.issues for delete using (true);

-- ═══════════ 0003_audit_softdelete.sql ═══════════
-- Plan B: audit_log + soft-delete + 닉네임 세션 변수

-- ===== audit_log 테이블 =====
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   text not null,
  action      text not null check (action in ('insert','update','delete')),
  changed_by  text not null default '익명',
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_table_record
  on public.audit_log(table_name, record_id);
create index if not exists idx_audit_log_created
  on public.audit_log(created_at desc);

-- ===== audit_log RLS (열린 편집과 동일) =====
alter table public.audit_log enable row level security;
create policy "audit_open_read"  on public.audit_log for select using (true);
create policy "audit_open_write" on public.audit_log for insert with check (true);

-- ===== 닉네임 세션 변수 설정 RPC =====
-- 클라이언트가 supabase.rpc('set_user_context', { p_nickname: '지훈' }) 호출
create or replace function public.set_user_context(p_nickname text)
returns void as $$
begin
  perform set_config('app.changed_by', coalesce(p_nickname, '익명'), true);
end;
$$ language plpgsql security definer;

-- ===== audit 트리거 함수 =====
-- 모든 대상 테이블의 INSERT/UPDATE/DELETE를 캡처
create or replace function public.audit_capture()
returns trigger as $$
begin
  insert into public.audit_log (table_name, record_id, action, changed_by, old_value, new_value)
  values (
    tg_table_name,
    coalesce((new).id::text, (old).id::text),
    tg_op,
    coalesce(current_setting('app.changed_by', true), '익명'),
    case when tg_op in ('update','delete') then to_jsonb(old) - 'guideline_doc' end,
    case when tg_op in ('insert','update') then to_jsonb(new) - 'guideline_doc' end
  );
  return coalesce(new, old);
end;
$$ language plpgsql;

-- ===== 트리거 부착 (5개 테이블) =====
drop trigger if exists trg_audit_decisions       on public.decisions;
drop trigger if exists trg_audit_milestones       on public.milestones;
drop trigger if exists trg_audit_checklist_items  on public.checklist_items;
drop trigger if exists trg_audit_issues           on public.issues;

create trigger trg_audit_decisions
  after insert or update or delete on public.decisions
  for each row execute function public.audit_capture();

create trigger trg_audit_milestones
  after insert or update or delete on public.milestones
  for each row execute function public.audit_capture();

create trigger trg_audit_checklist_items
  after insert or update or delete on public.checklist_items
  for each row execute function public.audit_capture();

create trigger trg_audit_issues
  after insert or update or delete on public.issues
  for each row execute function public.audit_capture();

-- teams는 guideline_doc(JSONB, 큼)을 제외하고 캡처 (위 함수에서 - 'guideline_doc' 처리)
drop trigger if exists trg_audit_teams on public.teams;
create trigger trg_audit_teams
  after insert or update or delete on public.teams
  for each row execute function public.audit_capture();

-- ===== soft-delete: deleted_at 컬럼 추가 =====
alter table public.teams           add column if not exists deleted_at timestamptz;
alter table public.decisions       add column if not exists deleted_at timestamptz;
alter table public.milestones      add column if not exists deleted_at timestamptz;
alter table public.checklist_items add column if not exists deleted_at timestamptz;
alter table public.issues          add column if not exists deleted_at timestamptz;

-- ═══════════ 0004_fix_session_context.sql ═══════════
-- C2 fix: set_user_context의 is_local을 false로 변경 (세션 스코프)
-- 기존 0003에서 true(트랜잭션 스코프)로 설정되어 있어 실제 쓰기 시점에는 사라지는 문제 해결.
-- false로 설정하면 세션 전체에서 유지되어 audit 트리거가 닉네임을 읽을 수 있음.
create or replace function public.set_user_context(p_nickname text)
returns void as $$
begin
  perform set_config('app.changed_by', coalesce(p_nickname, '익명'), false);
end;
$$ language plpgsql security definer;

-- C3 fix: 가이드라인 섹션 원자적 업데이트 RPC
-- 클라이언트에서 read-modify-write(전체 guideline_doc 덮어쓰기)를 하면
-- 동시 편집 시 데이터 유실이 발생하므로, 서버에서 JSONB를 원자적으로 갱신.
create or replace function public.update_guideline_section(
  p_team_id text,
  p_section_id text,
  p_content_md text
) returns void as $$
declare
  doc jsonb;
begin
  select guideline_doc into doc from public.teams where id = p_team_id;
  if doc is null then return; end if;

  doc := jsonb_set(
    doc,
    '{sections}',
    (
      select jsonb_agg(
        case
          when (s->>'id') = p_section_id
          then jsonb_set(s, '{content_md}', to_jsonb(p_content_md))
          else s
        end
      )
      from jsonb_array_elements(doc->'sections') as s
    )
  );

  update public.teams set guideline_doc = doc where id = p_team_id;
end;
$$ language plpgsql security definer;

-- ═══════════ 0006_fix_audit_trigger_case.sql ═══════════
-- Fix: tg_op는 대문자('UPDATE')를 반환하지만 audit_log CHECK 제약조건은 소문자('update')를 요구
-- audit_capture() 함수에서 lower(tg_op)를 사용하도록 수정

create or replace function public.audit_capture()
returns trigger as $$
begin
  insert into public.audit_log (table_name, record_id, action, changed_by, old_value, new_value)
  values (
    tg_table_name,
    coalesce((new).id::text, (old).id::text),
    lower(tg_op),
    coalesce(current_setting('app.changed_by', true), '익명'),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - 'guideline_doc' end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) - 'guideline_doc' end
  );
  return coalesce(new, old);
end;
$$ language plpgsql;

-- ═══════════ 0005_seed_data.sql ═══════════
-- 26-2 스포츠데이 허브 시드 데이터
-- 자동 생성: scripts/migrate-from-md.ts
-- 재실행 가능 (idempotent): ON CONFLICT DO NOTHING/UPDATE

BEGIN;

-- ===== teams =====
INSERT INTO public.teams (id, name, name_en, color, icon, sort_order, mission, guideline_doc) VALUES ('management', '기획관리팀', 'Management', '#6366f1', 'Settings', 0, '전체 총괄, 진행상황 업데이트, 팀 간 조율', '{"sections":[{"id":"1-행사-개요","title":"1. 행사 개요","order":0,"content_md":"## 1. 행사 개요\n| 항목 | 내용 | 비고 |\n|---|---|---|\n| **행사명** | **HI-Side Out** | 확정 |\n| **행사일** | **2026년 9월 19일 (토)** | 확정 |\n| **시간** | (미정 - 작년 10:00~19:00 참고) | |\n| **본 행사 장소** | **율전 대운동장** (자연과학캠퍼스) | 확정 |\n| **우천 시** | 율전 수성관 | 확정 |\n| **명륜 출발 버스** | 2대 (약 80명) | 명륜 → 율전 이동 |\n| **참여 인원** | 교환학생 **약 150명** + 하이클럽 | |\n| **참고 템플릿** | **25-2(주)** 율전 9월 / 26-1(보조) 명륜 | 25-2: `25 스포츠데이 참고용 자료/`, 26-1: `../26-1 Sports Day/` |\n\n> ⚠️ **주의 (참고 자료 방향성)**:\n> - **25-2(주 템플릿)**: 이번 26-2와 **같은 장소(율전)·같은 시기(9월)·같은 버스 구조(명륜→율전)**. 직접 비교 기준.\n> - **26-1(보조 참고)**: 명륜 기준이라 장소가 다르나, **운영 인원이 동일**하여 피드백·인원 구성 참고용.\n> - 명륜 인원(교환+하클)이 버스로 율전으로 이동하는 구조는 25-2와 동일.\n\n---"},{"id":"2-기획팀-조직도","title":"2. 기획팀 조직도","order":1,"content_md":"## 2. 기획팀 조직도\n| 팀 | 담당 업무 요약 | 세부 지침 파일 |\n|---|---|---|\n| **기획관리팀** | 전체 총괄, 진행상황 업데이트, 팀 간 조율, 공식계정 컨택 내용 공유 | (본 파일) |\n| **타임라인/인원관리팀** | 전체 타임라인, 하클 인원 배치, 명륜 버스 운영 | `타임라인_인원관리팀/타임라인_인원관리팀_지침.md` |\n| **교환담당팀** | 구글폼, 참여자 명단, 교환 팀 배정, 카드뉴스 인계물 | `교환담당팀/교환담당팀_지침.md` |\n| **컨텐츠팀** | 게임 구성·규칙, 배치도, 필요 인원/물품 | `컨텐츠팀/컨텐츠팀_지침.md` |\n| **예산팀** | 예산안, 입장료, 식사, 단체티, 준비물 리스트 | `예산팀/예산팀_지침.md` |\n\n---"},{"id":"5-과거-실적-기준값-빠른-참조","title":"5. 과거 실적 기준값 (빠른 참조)","order":2,"content_md":"## 5. 과거 실적 기준값 (빠른 참조)\n> 상세는 각 팀 지침의 \"작년 실적\" 섹션 참고\n>\n> 🎯 **템플릿 우선순위**:\n> - **25-2(2025 가을, 율전) = 주 템플릿** — 이번 26-2와 **같은 장소(율전)·같은 시기(9월)·같은 버스 구조(명륜→율전)**. 직접 비교 기준.\n> - **26-1(2026 봄, 명륜) = 보조 참고** — 장소가 다르나 **운영 인원이 동일**하여 피드백·인원 구성 참고용.\n> - 26-2는 9/19(토), 25-2는 9/20(토)로 **시기가 사실상 동일** (날씨·일조·학사일정 거의 공유)."},{"id":"51-252-실적-주-기준-율전-9월","title":"5-1. 25-2 실적 (주 기준 — 율전, 9월)","order":3,"content_md":"## 5-1. 25-2 실적 (주 기준 — 율전, 9월)\n> 행사명: Super ''HI''-rio Party (마리오) / 2025-09-20(토) / 율전 대운동장 10:00~19:00\n> 교환학생 100명 + 하클 48명 / 5팀 (YELLOW/PINK/GREEN/BLUE/PURPLE)\n> 명륜 집합 09:30 국제관 L → 버스 → 율전 / 귀환 18:30 셔틀\n> 우천시: 취소 (26-2는 수성관으로 개선)\n\n| 항목 | 25-2 실적 | 비고 |\n|---|---|---|\n| 장소 | **율전 대운동장** (자연캠) | **이번과 동일** |\n| 팀 구성 | 5팀 (YELLOW/PINK/GREEN/BLUE/PURPLE) | 이번은 6팀 |\n| **총 지출** | **약 4,387,520원** | |\n| **수입** | **약 1,500,000원** | |\n| **결손(적자)** | **약 475,320원** | |\n| **입장료** | **15,000원** | D4 참고 |\n| 점심 | **불고기버거** | D5 참고 |\n| 천막 | **게임연구소 550,000원** | 26-1(국제처지원 1,360,000원)과 다름 |\n| 단체티 | **신규 제작 158장, 2,063,200원** | D6 참고 (26-1은 작년 티 잔여 50장 추가) |\n| 버스 | 명륜→율전 왕복 | 이번과 동일 구조 |"},{"id":"52-261-실적-보조-명륜-2026-봄","title":"5-2. 26-1 실적 (보조 — 명륜, 2026 봄)","order":4,"content_md":"## 5-2. 26-1 실적 (보조 — 명륜, 2026 봄)\n> 행사명: Super ''HI''-rio Party (마리오) / 명륜 대운동장\n> ⚠️ 장소가 명륜으로 이번(율전)과 다름. 단, 운영 인원 동일 → 피드백/인원 구성 참고용.\n\n| 항목 | 26-1 실적 | 비고 |\n|---|---|---|\n| 행사명 | Super ''HI''-rio Party (마리오) | |\n| 장소 | 명륜 대운동장 (인사캠) | **이번엔 율전 (25-2 기준)** |\n| 팀 구성 | 5팀 (Mario/Luigi/Wario/Waluigi/Boo) | |\n| 토너먼트 | 4종 (코인뒤집기/무궁화/줄다리기/피구) | |\n| 메인게임 | 2종 (짝찾기/혼성계주) | 계주는 하클팀 포함 6팀 |\n| 미니게임 | 6종 (도장투어) | 1부 3종/2부 3종 |\n| 점수배분 | 100/80/60/40/40 (5팀) | |\n| **총 지출** | **약 3,176,048원** | |\n| **수입(예상)** | **약 1,950,000원** | |\n| **흑자** | **약 516,952원** | 25-2(적자)와 대조 |\n| **입장료** | **15,000원** | 25-2와 동일 |\n| 점심 | 한솥 돈까스 도시락(5,200~6,000) + 포케(비건 10,900) | 25-2(불고기버거)와 다름 |\n| 천막 | 업체대여 **1,360,000원** (국제처 섭외) | 25-2(게임연구소 550,000원)와 다름 |\n| 단체티 | 탑앤탑, 단가 12,400원, **추가 50장** | 25-2(신규 158장)와 다름 |\n| 게임용품 | 게임연구소 렌탈(98,000원 + 아이스박스) | |\n\n---"},{"id":"9-참고-자료-위치","title":"9. 참고 자료 위치","order":5,"content_md":"## 9. 참고 자료 위치\n> 💡 과거 기록(26-1, 25-1, 25-2)은 **\"지난 기록 참고\"** 용도로 적극 활용.\n> 같은 망고(반복되는 실수)를 피하고, 검증된 운영 노하우를 계승하기 위해 수시로 참조할 것.\n>\n> 🎯 **템플릿 우선순위 (중요)**:\n> - **9-2. 25-2(2025 가을, 율전) = 주 템플릿** — 이번 26-2와 **같은 장소(율전)·같은 시기(9월)·같은 버스 구조**.\n> - **9-3. 26-1(2026 봄, 명륜) = 보조 참고** — 장소는 다르나 **운영 인원 동일** → 피드백·인원 구성 참고용."},{"id":"91-이번-학기262-자료","title":"9-1. 이번 학기(26-2) 자료","order":6,"content_md":"## 9-1. 이번 학기(26-2) 자료\n| 자료 | 경로 | 용도 |\n|---|---|---|\n| 26-2 기획 일정 | `26-2 Sports Day 기획 일정.xlsx` | 마일스톤 원본 |\n| 26-2 기획 가이드라인 | `[필독!] 스포츠데이 기획 가이드라인.docx` | 팀별 업무 가이드 |\n| 26-2 1차 회의록 | `스포츠데이 기획팀 1차 회의.docx` | 컨셉/종목 후보 |"},{"id":"92-252-2025-가을-율전-주-템플릿","title":"9-2. 25-2 (2025 가을, 율전) — 🎯 주 템플릿","order":7,"content_md":"## 9-2. 25-2 (2025 가을, 율전) — 🎯 주 템플릿\n> 컨셉: 마리오 / **율전 대운동장** / 5팀 / 2025-09-20(토)\n> ⭐ **이번 26-2와 같은 장소(율전)·같은 시기(9월)·같은 버스 구조(명륜→율전)**. 직접 비교 기준으로 최우선 참조.\n\n| 자료 | 경로 | 용도 |\n|---|---|---|\n| **25-2 최종기획안** | `25 스포츠데이 참고용 자료/[2025_Fall_...]인원관리표.xlsx` | **율전 기준 주 템플릿** (개요~피드백) |\n| **25-2 게임 구성/규칙** | `25 스포츠데이 참고용 자료/[2025_Fall_Sports Day] 게임 구성 및 규칙.docx` | 25년 게임 세트 (율전 기준) |\n| 25-2 홍보부 인계물 | `25 스포츠데이 참고용 자료/[2025_Fall_...]홍보부 인계물(게임 룰 종합).docx` | 카드뉴스 양식 |\n| 25-2 안내(PDF) | `25 스포츠데이 참고용 자료/25-2 Sports Day (교환용).pdf` | 교환학생 배포용 |\n| 25-2 추가접수 | `25 스포츠데이 참고용 자료/25-2 Sports Day Extra Registration (교환용).docx/pdf` | 추가 모집 양식 |\n| 25 배치도 | `25 스포츠데이 참고용 자료/스포츠데이 배치도.pptx` | **율전 배치도 PPT 템플릿** |"},{"id":"93-261-2026-봄-명륜-보조-참고","title":"9-3. 26-1 (2026 봄, 명륜) — 보조 참고","order":8,"content_md":"## 9-3. 26-1 (2026 봄, 명륜) — 보조 참고\n> 컨셉: 마리오 / **명륜 대운동장** / 5팀\n> ⚠️ 장소가 명륜으로 이번(율전)과 다름. 단, **운영 인원이 이번 26-2와 동일**하므로 피드백·인원 구성·업무 분담 참고용.\n\n| 자료 | 경로 | 용도 |\n|---|---|---|\n| **최종기획안** | `../26-1 Sports Day/[2026_Spring_...]인원관리표.xlsx` | **8개 시트** (개요~피드백, 운영 인원 동일) |\n| 게임 구성/규칙 | `../26-1 Sports Day/컨텐츠팀/2026_Spring_SportsDay_게임 구성 및 규칙.docx` | 게임 규칙 상세 |\n| 배치도 | `../26-1 Sports Day/컨텐츠팀/2026_Spring SportsDay_배치도.docx` | 배치도 참고 (명륜 기준 주의) |\n| 예산안 | `../26-1 Sports Day/예산팀/26-1 Sports Day 예산안.xlsx` | 예산 기준 (보조) |\n| 교환 팀 편성 | `../26-1 Sports Day/26-1 스포츠데이 교환학생 팀 편성.xlsx` | 팀 배정 양식 |\n| 점수 집계 | `../26-1 Sports Day/점수 집계팀.xlsx` | 점수 집계 양식 |\n| 홍보부 인계물(게임 룰) | `../26-1 Sports Day/교환담당팀/[2026_Spring_Sports Day] 홍보부 인계물(게임 룰 종합).docx` | 카드뉴스 인계물 양식 |\n| 출석부/수금 | `../26-1 Sports Day/교환담당팀/출석부.xlsx`, `스포츠데이 수금.xlsx` | 구글폼/수금 양식 |"},{"id":"94-251-자료-및-기타-과거-사례","title":"9-4. 25-1 자료 및 기타 (과거 사례)","order":9,"content_md":"## 9-4. 25-1 자료 및 기타 (과거 사례)\n> 25-1(2025 봄) 자료는 더 과거 사례로 보조 참고용.\n\n| 자료 | 경로 | 용도 |\n|---|---|---|\n| 25-1 체크리스트 | `25 스포츠데이 참고용 자료/25-1 Sports Day 체크리스트.xlsx` | 행사 당일 체크리스트 |\n| 25-1 미니게임 빙고판 | `25 스포츠데이 참고용 자료/25_1-스포츠데이-미니게임-빙고판.pdf` | 미니게임 빙고 디자인 |\n| 25-1 카드뉴스 | `25 스포츠데이 참고용 자료/[2025_Spring_...]홍보부 인계물(카드뉴스).docx` | 카드뉴스 디자인 |\n| 25-1 토너먼트 | `25 스포츠데이 참고용 자료/[2025_Spring_...]홍보부 인계물(토너먼트).docx` | 토너먼트 안내 양식 |\n| 25-1 미니게임 | `25 스포츠데이 참고용 자료/[2025_Spring_...]홍보부 인계물(미니게임).docx` | 미니게임 안내 양식 |"},{"id":"95-과거-회의-진행-패턴-참고용-인사이트","title":"9-5. 과거 회의 진행 패턴 (참고용 인사이트)","order":10,"content_md":"## 9-5. 과거 회의 진행 패턴 (참고용 인사이트)\n> 25-2 최종기획안 \"0. 개요\"의 회의 일정에서 추출한 패턴 (주 템플릿 25-2 기준)\n\n| 회의 | 25-2 일시 | 주요 논의 | 우리 26-2 참고점 |\n|---|---|---|---|\n| 1차 회의 | 3/26 | 실무팀 인원 배정, 고정회의 날짜 | → 우리 1차(7/28) |\n| **2차 회의** | **3/31** | 작년 피드백 검토, **컨셉 결정, 종목 확정**, 가이드라인 제공 | → 우리 2차(8/9)와 유사 |\n| 3차 회의 | 4/7 | 국제처 전달사항, 콘텐츠 확정, 식사/단체복 리스트업, 타임라인 outline, **입장료 임시 확정**, 구글폼 초안 | → 우리 8/16(컨텐츠완성)~8/20(구글폼) 구간 |\n| 4차 회의 | 4/21 | 천막/물품 업체 확정, 명단 제작, 단체티 주문 마감 | → 우리 9월 초 구간 |\n\n> 💡 **인사이트**: 25-2는 회의를 4회 거치며 점진적 확정.\n> 우리 26-2는 2차(8/9)에서 \"방향 점검\" → 8/16 컨텐츠 완성 후 세부 확정 흐름으로 진행 중.\n> 25-2(9/20)와 26-2(9/19)는 **시기가 사실상 동일**하여 학사일정·날씨 대응 패턴 그대로 참조 가능."}]}'::jsonb) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en, color=EXCLUDED.color, icon=EXCLUDED.icon, mission=EXCLUDED.mission, guideline_doc=EXCLUDED.guideline_doc;
INSERT INTO public.teams (id, name, name_en, color, icon, sort_order, mission, guideline_doc) VALUES ('content', '컨텐츠팀', 'Content', '#ec4899', 'Gamepad2', 1, '게임 구성·규칙, 배치도, 필요 인원/물품', '{"sections":[{"id":"1-팀-미션-산출물","title":"1. 팀 미션 & 산출물","order":0,"content_md":"## 1. 팀 미션 & 산출물\n"},{"id":"미션","title":"미션","order":1,"content_md":"## 미션\n- 토너먼트 게임 4종, 메인 게임 2종, 미니게임 6종 기획\n- 하클이 함께 참여할 수 있는 게임 포함\n- 행사 배치도 작성 (장소: **율전 대운동장** / 우천 시 수성관)"},{"id":"주요-산출물-일정","title":"주요 산출물 & 일정","order":2,"content_md":"## 주요 산출물 & 일정\n> 💡 **8/9 산출물 기준**: \"완성된 초안\"이 아니라 **방향성 뼈대**입니다.\n> - 🟡 **방향(8/9 회의)**: 게임 12종 선종 후보 + 점수 철학(완만/가파름/등간격)\n> - ⚪ **보류(8/16 완성)**: 출전인원 상세, 물품 수량, 시간 설계, 캐릭터 매핑, 배치도\n\n- [ ] 🟡 컨텐츠 **방향성 뼈대** (게임 선종 후보 + 점수 철학) — **8/9(2차 회의 전)**\n- [ ] ⚪ 컨텐츠 완성 (상세 시트 포함) — **8/16**\n- [ ] 컨텐츠 안내 홍보부 인계 — 8/30\n- [ ] 행사 배치도 (율전 대운동장)\n- [ ] 각 게임별 상세 시트 (출전인원/규칙/물품/소요시간/심판)"},{"id":"타-팀과의-연계","title":"타 팀과의 연계","order":3,"content_md":"## 타 팀과의 연계\n| 받을 정보 | 제공 팀 | 시기 |\n|---|---|---|\n| 팀 개수·팀당 인원 (D2) | 기획관리팀 | 2차 회의 전 |\n| 컨셉/팀명/컬러 (D1/D3) | 기획관리팀 | 2차 회의 전 |\n| 줄 정보 | 교환담당팀 | 팀 배정 후 |\n\n| 제공 정보 | 받는 팀 | 시기 |\n|---|---|---|\n| **게임 12종 방향(선종)** | **타임라인팀** (8/13 타임라인 베이스용) | **8/9 회의에서** ⭐ |\n| 게임별 필요 물품 리스트 | 예산팀 | 8/16(확정) / 8/9는 방향만 |\n| 게임 종류·타임라인 | 교환담당팀(카드뉴스용) | 컨텐츠 확정 후 |\n| 전체 타임라인에 맞춘 게임 배치 | 타임라인팀 | 8/16 이후 |\n\n---"},{"id":"2-게임-구성-가이드라인-요구사항","title":"2. 게임 구성 (가이드라인 요구사항)","order":4,"content_md":"## 2. 게임 구성 (가이드라인 요구사항)\n> 컨셉이 확정되면(D1) 아래 양식에 맞춰 작성. **기본 뼈대는 25-2(율전, 같은 장소) 게임 구성**을 주 템플릿으로 사용. 26-1(명륜)은 장소가 달라 보조 참고.\n> 🎨 **인사이드아웃 컨셉 각색**: 25-2 게임 뼈대 위에 감정(Joy/Sadness/Anger/Fear/Disgust/Anxiety 등) 테마를 씌워 각색 — 게임 종목 자체는 25-2를 우선 유지하되 네이밍·소품·진행 멘트에 컨셉 반영."},{"id":"필수-구성","title":"필수 구성","order":5,"content_md":"## 필수 구성\n| 구분 | 개수 | 참여 방식 | 비고 |\n|---|---|---|---|\n| 토너먼트 게임 | **4종** | 팀별 일부 인원만 참여 | 부전승 공식화 |\n| 메인 게임 | **2종** | 모든 팀이 같이 경기 | 1부·2부에 1종씩 |\n| 미니게임 | **6종** | 자유 부스 형식 (도장 투어) | 1부 3종 / 2부 3종 |"},{"id":"1차-회의-검토-종목-후보","title":"1차 회의 검토 종목 후보","order":6,"content_md":"## 1차 회의 검토 종목 후보\n> 출처: 26-2 1차 회의록\n```\n무궁화꽃이피었습니다 / 줄다리기 / 판 뒤집기 / 계주 / 피구 /\n장애물 계주 / 짝짓기 게임 / 풋살 / 눈치 물 바가지 / 물 옮기기 릴레이 /\n농구 / 물총놀이 / 풍선 탑 쌓기 / 꼬리잡기 / 전략줄다리기\n```\n\n---"},{"id":"3-게임별-작성-양식-각-종목마다-이-양식-사용","title":"3. 게임별 작성 양식 (각 종목마다 이 양식 사용)","order":7,"content_md":"## 3. 게임별 작성 양식 (각 종목마다 이 양식 사용)\n> 25-2(율전) 게임 구성 문서의 양식을 그대로 차용. 컨셉 확정 후 아래를 복제하여 각 게임별로 작성.\n\n```"},{"id":"n-게임명-참여-팀-수참여-1부2부토너먼트메인미니","title":"N) 🎮 [게임명] — [참여 팀 수]참여 (1부/2부/토너먼트/메인/미니)","order":8,"content_md":"## N) 🎮 [게임명] — [참여 팀 수]참여 (1부/2부/토너먼트/메인/미니)\n① 컨셉 (D1 확정 후 각색)\n② 출전 인원: 팀당 O명 (성별 제한: O/O 없음)\n③ 진행 방식:\n④ 주요 규칙:\n⑤ 점수 부여 방식: (토너먼트 점수배분 참조 / 미니게임=도장)\n⑥ 예상 경기 시간:\n⑦ 심판 및 필요 인원: 심판 O명 / 보조 O명\n⑧ 필요한 물품: (예산팀에 인계)\n```\n\n---"},{"id":"4-점수-집계-체계-d2-팀-개수-확정-후-확정","title":"4. 점수 집계 체계 (D2 팀 개수 확정 후 확정)","order":9,"content_md":"## 4. 점수 집계 체계 (D2 팀 개수 확정 후 확정)\n> 출처: **25-2(율전) 게임 구성** — 동일 장소 운영 기준. 팀 수 변경 시 아래 옵션 참고."},{"id":"토너먼트-점수배분-252-5팀-기준","title":"토너먼트 점수배분 (25-2 5팀 기준)","order":10,"content_md":"## 토너먼트 점수배분 (25-2 5팀 기준)\n| 순위 | 1위 | 2위 | 3위 | 4위 | 5위 | (6위) |\n|---|---|---|---|---|---|---|\n| 점수 | 100 | 80 | 60 | 40 | 40 | (?) |\n\n- 메인게임 점수배분(25-2 5팀): **100 / 80 / 60 / 40 / 20**\n- **부전승 공식화**: 부전승 팀은 별도 패널티 없이 다음 라운드 진출 (최소 3위 점수 확보)\n- 매 경기마다 대진 추첨 (제비뽑기)으로 부전승 혜택 분산"},{"id":"미니게임-점수-도장-투어-252-기준","title":"미니게임 점수 (도장 투어 — 25-2 기준)","order":11,"content_md":"## 미니게임 점수 (도장 투어 — 25-2 기준)\n- 게임 성공 시 도장 1개 (중복 불가)\n- **도장 3개 → 뽑기 1회 / 5개 → 2회 / 6개 → 3회** (뽑기 후 도장에 체크)\n- 토너먼트 점수와 무관\n- 뽑기 상품(25-2): 1등 필름카메라 / 2등 달고나 / 3등 별뽀빠이 / 4등 신쫄이 / 5등 사탕"},{"id":"6팀인사이드아웃-전환-시-점수배분-재설계-옵션","title":"6팀(인사이드아웃) 전환 시 점수배분 재설계 옵션","order":12,"content_md":"## 6팀(인사이드아웃) 전환 시 점수배분 재설계 옵션\n> 출처: 25-2 5팀 배분을 기준으로 6팀 확장 설계.\n\n| 순위 | 1위 | 2위 | 3위 | 4위 | 5위 | 6위 |\n|---|---|---|---|---|---|---|\n| 토너먼트(안) | 100 | 85 | 70 | 55 | 40 | 40 |\n| 메인(안) | 100 | 85 | 70 | 55 | 40 | 20 |\n\n- 공통 원칙: 꼴등(6위)은 최소 보장점수 부여, 부전승 혜택은 4강 이상에서만 적용 검토.\n\n---"},{"id":"5-과거-기록-참고","title":"5. 과거 기록 참고","order":13,"content_md":"## 5. 과거 기록 참고\n> 💡 게임 기획 시 과거 기록을 적극 참고. 같은 망고(반복 실수)를 피하고 검증된 운영 노하우 계승.\n> ⭐ **주 템플릿 = 25-2(율전)**: 이번 26-2와 **같은 장소(율전 대운동장)** → 게임 구성·배치도의 기본 뼈대.\n> 26-1(명륜)은 장소가 달라 보조 참고."},{"id":"51-252-2025-가을-주-템플릿","title":"5-1. 25-2 (2025 가을) — 🌟 주 템플릿","order":14,"content_md":"## 5-1. 25-2 (2025 가을) — 🌟 주 템플릿\n> 컨셉: (25-2 컨셉) / **율전 대운동장** / 5팀 — 이번 26-2와 동일 장소.\n> 게임 구성·규칙·배치도·소요시간의 **기준 템플릿**.\n\n| 자료 | 경로 | 참고점 |\n|---|---|---|\n| **25-2 게임 구성/규칙** | `../25 스포츠데이 참고용 자료/[2025_Fall_Sports Day] 게임 구성 및 규칙.docx` | **게임 세트(토너먼트4/메인2/미니6)의 주 뼈대** |\n| **25 배치도** | `../25 스포츠데이 참고용 자료/스포츠데이 배치도.pptx` | **배치도 PPT 템플릿 (율전 60m×40m 기준)** |\n| 25-1 미니게임 빙고판 | `../25 스포츠데이 참고용 자료/25_1-스포츠데이-미니게임-빙고판.pdf` | 미니게임 빙고 디자인 (도장투어 변형 아이디어) |"},{"id":"52-작년261-2026-봄-보조-참고","title":"5-2. 작년(26-1, 2026 봄) — 보조 참고","order":15,"content_md":"## 5-2. 작년(26-1, 2026 봄) — 보조 참고\n> 컨셉: 마리오 / **명륜** 대운동장 / 5팀 — **장소 상이(명륜)**.\n> 게임 일부(무궁화 등) 아이디어 원천으로 활용. 배치도는 명륜 기준이므로 참고용.\n\n| 자료 | 경로 | 참고점 |\n|---|---|---|\n| 게임 구성/규칙 | `../../26-1 Sports Day/컨텐츠팀/2026_Spring_SportsDay_게임 구성 및 규칙.docx` | 게임 규칙 상세 (일부 게임 아이디어 보조 원천) |\n| 배치도 | `../../26-1 Sports Day/컨텐츠팀/2026_Spring SportsDay_배치도.docx` | 배치도 (**명륜 기준 — 참고만**, 배치는 25-2 기준) |\n\n> 활용 팁: **25-2 게임(주 뼈대)** + 26-1 게임(보조 아이디어)을 비교 검토하여, 인사이드아웃 6팀에 가장 적합한 구성 선정.\n\n---"},{"id":"6-과거-게임-구성-참고","title":"6. 과거 게임 구성 (참고)","order":16,"content_md":"## 6. 과거 게임 구성 (참고)\n> 🌟 **주 템플릿 = 25-2(율전)** → 동일 장소(율전 대운동장) 기준. 게임 뼈대·소요시간의 1차 원천.\n> 보조 = 26-1(명륜) → 장소 상이, 일부 게임 아이디어 원천으로만.\n> 상세 규칙:\n> - 25-2: `../25 스포츠데이 참고용 자료/[2025_Fall_Sports Day] 게임 구성 및 규칙.docx`\n> - 26-1: `../../26-1 Sports Day/컨텐츠팀/2026_Spring_SportsDay_게임 구성 및 규칙.docx`"},{"id":"61-252-율전-주-템플릿","title":"6-1. 🌟 25-2 (율전) — 주 템플릿","order":17,"content_md":"## 6-1. 🌟 25-2 (율전) — 주 템플릿\n"},{"id":"토너먼트-4종","title":"토너먼트 4종","order":18,"content_md":"## 토너먼트 4종\n| 게임 | 출전 | 핵심 규칙 | 소요시간 |\n|---|---|---|---|\n| 🟦 색깔판 뒤집기 | 팀당 6명 | 3분간 판 뒤집기 | 3분 |\n| 🧣 **꼬리잡기** | 팀당 20명 (10명씩 2팀) | 수건 사용, 5분 | 5분 |\n| 🪢 줄다리기 | 여7+남5=12명 | 2분 제한 | 2분 |\n| 🏐 단체 피구 | 팀당 12명 | 8분 제한 | 8분 |"},{"id":"메인게임-2종","title":"메인게임 2종","order":19,"content_md":"## 메인게임 2종\n| 게임 | 출전 | 핵심 규칙 |\n|---|---|---|\n| 💦 짝짓기 게임 (1부 메인) | 전원 | 음악 중 이동, **물총** 맞으면 탈락 |\n| 🏃 계주 (2부 메인) | 팀당 6명(3M/3F) + 하클팀 | 하클 포함 6팀, **하클대항전 ±300점** |"},{"id":"미니게임-6종-도장-투어","title":"미니게임 6종 (도장 투어)","order":20,"content_md":"## 미니게임 6종 (도장 투어)\n| 부문 | 게임 | 핵심 |\n|---|---|---|\n| 1부 | 제기차기 | 도장 조건 |\n| 1부 | 참참참 | 도장 조건 |\n| 1부 | 긴줄넘기 | 도장 조건 |\n| 2부 | **딱지치기** | 도장 조건 |\n| 2부 | 림보 | 도장 조건 |\n| 2부 | **병뚜껑날리기** | 도장 조건 |"},{"id":"소요시간-타임라인-252-기준","title":"소요시간 타임라인 (25-2 기준)","order":21,"content_md":"## 소요시간 타임라인 (25-2 기준)\n| 구분 | 시간 |\n|---|---|\n| 1부 | 13:30 ~ 15:15 |\n| 휴식 | 30분 |\n| 2부 | 15:50 ~ 17:35 |"},{"id":"62-261-명륜-보조-참고","title":"6-2. 26-1 (명륜) — 보조 참고","order":22,"content_md":"## 6-2. 26-1 (명륜) — 보조 참고\n> 장소(명륜)가 달라 배치·소요시간은 참고용. 일부 게임 아이디어 원천."},{"id":"토너먼트-4종-261","title":"토너먼트 4종 (26-1)","order":23,"content_md":"## 토너먼트 4종 (26-1)\n| 게임 | 출전 | 핵심 규칙 | 비고 |\n|---|---|---|---|\n| 🍄 코인 뒤집기 (색깔판) | 팀당 6명 | 3분, 홀수 세팅 | 25-2와 동일 계열 |\n| 🌸 **무궁화꽃이피었습니다** | 팀당 전원 | 술래 몬스터 복장, 뿅망치 터치, 1분 | **26-1 독자** (25-2는 꼬리잡기) |\n| 💪 줄다리기 | 팀당 12명(남6/여6) | 30초 제한 | 25-2와 동일 계열(성비 상이) |\n| 🏀 단체 피구 | 팀당 12명 | 8분, 피치공주 룰 | 25-2와 동일 계열 |"},{"id":"메인게임-2종-261","title":"메인게임 2종 (26-1)","order":24,"content_md":"## 메인게임 2종 (26-1)\n| 게임 | 출전 | 핵심 규칙 |\n|---|---|---|\n| 🎮 짝 찾기 (1부 메인) | 교환 전원 | 같은 팀끼리 모이면 탈락 (물총 X) |\n| 🏁 혼성 계주 (2부 메인) | 팀당 6명(여3/남3) + 하클 | **하클 이기면 +10점** (25-2는 ±300점) |"},{"id":"미니게임-6종-261","title":"미니게임 6종 (26-1)","order":25,"content_md":"## 미니게임 6종 (26-1)\n| 부문 | 게임 | 비고 |\n|---|---|---|\n| 1부 | 제기차기 | 25-2와 동일 |\n| 1부 | 참참참 | 25-2와 동일 |\n| 1부 | 단체줄넘기 | 25-2(긴줄넘기)와 동일 계열 |\n| 2부 | 림보 | 25-2와 동일 |\n| 2부 | **손바닥 밀기** | **26-1 독자** (25-2는 딱지치기) |\n| 2부 | **카드 짝 찾기** | **26-1 독자** (25-2는 병뚜껑날리기) |"},{"id":"63-인사이드아웃-6팀-전환-시-게임-출처-비교표","title":"6-3. 인사이드아웃 6팀 전환 시 게임 출처 비교표","order":26,"content_md":"## 6-3. 인사이드아웃 6팀 전환 시 게임 출처 비교표\n> 각 슬롯별로 25-2(주) vs 26-1(보조) 중 어디서 가져올지 결정. ✅=채택 권장, 🔁=대안.\n\n| 슬롯 | 25-2(율전, 주) | 26-1(명륜, 보조) | 인사이드아웃 각색 방향 |\n|---|---|---|---|\n| 토너먼트 1 | ✅ 색깔판 뒤집기 (6명/3분) | 🔁 코인 뒤집기 (동일 계열) | 감정 판 색상 매핑 (Joy/Sad 등) |\n| 토너먼트 2 | ✅ **꼬리잡기** (20명/5분/수건) | 🔁 **무궁화** (전원/1분/뿅망치) | 둘 중 택1 — 꼬리잡기(인원풍부) 추천, 무궁화는 볼거리 우위 |\n| 토너먼트 3 | ✅ 줄다리기 (여7남5/2분) | 🔁 줄다리기 (남6여6/30초) | 25-2 성비·시간 기준 (부상방지 2분) |\n| 토너먼트 4 | ✅ 단체 피구 (12명/8분) | 🔁 피구 (피치공주 룰) | 25-2 기본 + 피치공주 룰은 선택 |\n| 메인 1 (1부) | ✅ 짝짓기 (물총 탈락) | 🔁 짝 찾기 (같은 팀 모이면 탈락) | 25-2 물총 버전 추천 (여름감성) |\n| 메인 2 (2부) | ✅ 계주 (6명/하클 **±300점**) | 🔁 계주 (하클 **+10점**) | **25-2 ±300점 추천** (스코어 임팩트 큼) |\n| 미니 1 | ✅ 제기차기 | 🔁 동일 | 공통 — 그대로 |\n| 미니 2 | ✅ 참참참 | 🔁 동일 | 공통 — 그대로 |\n| 미니 3 | ✅ 긴줄넘기 | 🔁 단체줄넘기 | 동일 계열 — 25-2 명칭 |\n| 미니 4 (2부) | ✅ **딱지치기** | 🔁 손바닥 밀기 | 25-2 추천 (인파 몰림 적음) |\n| 미니 5 (2부) | ✅ 림보 | 🔁 동일 | 공통 — 그대로 |\n| 미니 6 (2부) | ✅ **병뚜껑날리기** | 🔁 카드 짝 찾기 | 25-2 추천 (새로움) 또는 26-1 (안정성) |\n\n> 결정 우선순위: 동일 장소(율전) 경험 → 25-2 우선. 단 토너먼트 2(꼬리잡기 vs 무궁화)는 컨셉·인원풀 보고 택1.\n\n---"},{"id":"7-행사-배치도-율전-대운동장","title":"7. 행사 배치도 (율전 대운동장)","order":27,"content_md":"## 7. 행사 배치도 (율전 대운동장)\n> 🌟 **직접 기준 = 25-2(율전)**: 동일 장소이므로 25-2 배치도를 주 템플릿으로 사용.\n> 25-2 배치도: `../25 스포츠데이 참고용 자료/스포츠데이 배치도.pptx`\n> 26-1 배치도(명륜)는 참고용: `../../26-1 Sports Day/컨텐츠팀/2026_Spring SportsDay_배치도.docx`"},{"id":"기준-규격-252-율전","title":"기준 규격 (25-2 율전)","order":28,"content_md":"## 기준 규격 (25-2 율전)\n- 경기장: **율전 대운동장 60m × 40m (콘으로 구역 표시)**"},{"id":"252-배치-구성요소-율전-기준-그대로-차용","title":"25-2 배치 구성요소 (율전 기준 — 그대로 차용)","order":29,"content_md":"## 25-2 배치 구성요소 (율전 기준 — 그대로 차용)\n- [ ] **본부 천막 ×2** (경기장 중앙 상단)\n- [ ] **팀 천막 ×5** (인사이드아웃 6팀 → ×6 조정)\n- [ ] **미니게임 천막 ×3** (1부 3종 / 2부 3종 교체 운영)\n- [ ] **입장 관리 존 천막 ×2** (운동장 입구 → 이후 **의무대(응급처치)로 전환**)\n- [ ] 점수집계 부스 (본부 옆)\n- [ ] 경기장 구역 표시 (콘)"},{"id":"이번-배치도-초안-작성-공간-252-기준-율전-60m40m","title":"이번 배치도 초안 (작성 공간 — 25-2 기준 율전 60m×40m)","order":30,"content_md":"## 이번 배치도 초안 (작성 공간 — 25-2 기준 율전 60m×40m)\n```\n(율전 대운동장 60m × 40m — 25-2 템플릿 기반, 6팀 확장 분은 컨텐츠 확정 후 작성)\n\n[본부 천막×2] [점수집계]\n        ↓\n┌──────────────────────────────────┐\n│                                  │\n│   [토너먼트 경기장]               │\n│                                  │\n│  [미니게임 천막×3]                │\n│                                  │\n│  [팀천막×6]                       │\n└──────────────────────────────────┘\n   [입구] [입장관리 천막×2 → 의무대 전환]\n```\n\n---"},{"id":"8-필요-물품-리스트-예산팀-인계용","title":"8. 필요 물품 리스트 (예산팀 인계용)","order":31,"content_md":"## 8. 필요 물품 리스트 (예산팀 인계용)\n> 게임 확정 후 예산팀에 전달. 양식: 품목 / 개수 / 출처 / 비고\n\n| 게임 | 물품 | 개수 | 출처(브룸/렌탈/구매) | 비고 |\n|---|---|---|---|---|\n| (코인뒤집기) | 양면 색깔 판 | 홀수세팅(35장) | 작년 네이버 구매 | |\n| (줄다리기) | 밧줄 | 1 | 게임연구소 렌탈 | |\n| (줄다리기) | 목장갑 | 팀당 12켤레 | 작년 글융학생회 | 성비 안전장비 |\n| (피구) | 피구공 | 1 | 브룸 | |\n| (계주) | 바통 | 6 | 게임연구소 | |\n| (계주) | 결승 테이프 | 1 | 게임연구소 | |\n| (무궁화) | 뿅망치 | 2+ | | |\n| (무궁화) | 몬스터 복장 | 1 | | 간소화 가능 |\n| ... | | | | |\n\n> 게임이 확정되면 위 표를 채워 예산팀에 인계 (8/9 초안, 8/16 확정)\n\n---"}]}'::jsonb) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en, color=EXCLUDED.color, icon=EXCLUDED.icon, mission=EXCLUDED.mission, guideline_doc=EXCLUDED.guideline_doc;
INSERT INTO public.teams (id, name, name_en, color, icon, sort_order, mission, guideline_doc) VALUES ('budget', '예산팀', 'Budget', '#10b981', 'Wallet', 2, '예산안, 입장료, 식사, 단체티, 준비물 리스트', '{"sections":[{"id":"1-팀-미션-산출물","title":"1. 팀 미션 & 산출물","order":0,"content_md":"## 1. 팀 미션 & 산출물\n"},{"id":"미션","title":"미션","order":1,"content_md":"## 미션\n- 예산안 작성 (게임 물품 + 기본 준비물 + 단체티 + 식사)\n- 입장료 책정\n- 점심 식사 2종 준비 (비건 필수)\n- 간식/물/음료 준비\n- 단체티 제작·주문\n- 준비물 리스트 상시 관리 (주문전/배송중/완료/브룸)"},{"id":"주요-산출물-일정","title":"주요 산출물 & 일정","order":2,"content_md":"## 주요 산출물 & 일정\n> 💡 **8/9 산출물 기준**: \"완성된 예산안\"이 아니라 **방향성 뼈대**입니다.\n> - 🟡 **방향(8/9 회의)**: 단체티 방침 — **신규 제작 전제** (잔여 마리오 티는 26-1 배부 후 회수 미비로 파악 불가 → 재활용 배제)\n> - 🟡 **확인(8/9 회의)**: 단체티 주문처(탑앤탑) 리드타임 — 결정 시점 판단 자료\n> - 🟡 **방향(8/9 회의)**: 점심 메뉴 — 방향만\n> - ⚪ **입장료는 8/9 보류**: 동아리 보전 한도 사전 파악 후 8/16~8/25 결정\n> - ⚪ **보류(8/16 컨텐츠 완성 후)**: 단가 시뮬레이션, 수량 확정, 예산안 총액\n\n- [ ] 🟡 단체티 방침(신규 제작 전제) + 리드타임 확인 — **8/9 회의**\n- [ ] 🟡 점심 메뉴 방향 — **8/9 회의**\n- [ ] ⚪ 입장료 — **8/9 보류** (동아리 보전 한도 파악 후 8/16~8/25 결정)\n- [ ] ⚪ 예산안 작성(단가·수량·총액) — **8/16 이후** (컨텐츠 물품 리스트 수령 후)\n- [ ] 수금 부스 — 8/31\n- [ ] 준비물 주문 — 9/3\n- [ ] 단체티 주문 — 9/4"},{"id":"타-팀과의-연계","title":"타 팀과의 연계","order":3,"content_md":"## 타 팀과의 연계\n| 받을 정보 | 제공 팀 | 시기 |\n|---|---|---|\n| 게임별 필요 물품 리스트 | 컨텐츠팀 | 8/9(초안)/8/16(확정) |\n| 교환 팀 배정 결과(단체티 수량) | 교환담당팀 | 9/3 |\n| 참여 인원 확정 (식사 수량) | 교환담당팀 | 8/28 폼 마감 후 |\n\n| 제공 정보 | 받는 팀 | 시기 |\n|---|---|---|\n| 식사/단체티 정보 | 교환담당팀(카드뉴스용) | 컨텐츠 확정 후 |\n| 입장료 | 기획관리팀(결정 D4) | 8/16~8/25 (보전 한도 파악 후) |\n\n---"},{"id":"2-예산안-작성-가이드","title":"2. 예산안 작성 가이드","order":4,"content_md":"## 2. 예산안 작성 가이드\n"},{"id":"예산-항목-분류","title":"예산 항목 분류","order":5,"content_md":"## 예산 항목 분류\n> 💡 **25-2(주 기준) 기준일 때 최대 항목은 단체티(2,063,200원) + 천막(550,000원).**\n> 26-1처럼 천막을 국제처 지원(예산 外)으로 처리하면 항목 구성이 달라지므로 주의.\n\n1. **단체티**: 신규 제작 (이번 26-2 컨셉 변경) ← **예산 최대 항목** (25-2 기준 2,063,200원)\n2. **천막**: 업체 대여 — 25-2는 게임연구소(10개 55만), 26-1은 국제처(136만, 예산 外)\n3. **식사**: 점심(불고기버거) + 비건(배지샐러드)\n4. **게임용품**: 컨텐츠팀 요청 + 렌탈(게임연구소)\n5. **음료/물**: 탐사수, 이온음료 등\n6. **간식/뽑기상품**: 미니게임 뽑기용\n7. **우승상품**: 메달, 트로피 등\n8. **기타 진행용품**: 테이프, 쓰레기통 등"},{"id":"예산안-양식-252-준용","title":"예산안 양식 (25-2 준용)","order":6,"content_md":"## 예산안 양식 (25-2 준용)\n| 품목 | 개수 | 단일가격 | 총 금액 | 주문처 | 비고 |\n|---|---|---|---|---|---|\n\n---"},{"id":"3-핵심-결정-항목","title":"3. 핵심 결정 항목","order":7,"content_md":"## 3. 핵심 결정 항목\n"},{"id":"d4-입장료-89-보류-동아리-보전-한도-파악-후-816825-결정","title":"D4. 입장료 (⚪ 8/9 보류 / 동아리 보전 한도 파악 후 8/16~8/25 결정)","order":8,"content_md":"## D4. 입장료 (⚪ 8/9 보류 / 동아리 보전 한도 파악 후 8/16~8/25 결정)\n> ⚠️ **이번 26-2 예산 구조는 25-2(율전/9월/단체티 신규)와 유사 → 적자 불가피 구조.**\n> 입장료 수입만으로는 지출을 충당하지 못하며, **동아리 예산 보전 전제**로 기획해야 함.\n\n| 옵션 | 장점 | 단점 | 시뮬레이션 |\n|---|---|---|---|\n| **15,000원 (25-2 동일)** | 25-2 실적 검증됨, 부담 적당 | 적자 발생(동아리 보전) | ×100명 = 1,500,000원 |\n| 18,000~20,000원 (인상) | 적자 폭 ↓ | 교환학생 부담 ↑ | 참여율 하락 위험 |\n| 15,000원 + 간식 포함 패키지 | 가치 인식 ↑ | 마케팅 필요 | 수입은 동일, 지출 증가 |\n\n> 💡 **주 기준(25-2, 율전/9월)**: 입장료 **15,000원** × 약 100명 = 수입 **1,500,000원**\n> 총지출 4,387,520원 → **적자 475,320원(동아리 보전)**\n>\n> 💡 **보조 비교(26-1, 명륜/5월)**: 입장료 15,000원 × 약 130명 = 수입 1,950,000원\n> 총지출 3,176,048원 → **흑자 516,952원**(단체티 재활용 + 국제처 천막 지원 때문)\n> ※ 26-1 흑자는 특수 케이스(재활용/외부지원)이므로 **예산 기준으로 부적절. 단가 비교용으로만 참고.**"},{"id":"d5-점심-메뉴-89-방향-논의-비건-필수-2종-전제-수량은-828-폼-마감-후","title":"D5. 점심 메뉴 (🟡 8/9 방향 논의 — 비건 필수 2종 전제 / ⚪ 수량은 8/28 폼 마감 후)","order":9,"content_md":"## D5. 점심 메뉴 (🟡 8/9 방향 논의 — 비건 필수 2종 전제 / ⚪ 수량은 8/28 폼 마감 후)\n> ⚠️ **주 기준은 25-2(불고기버거, 롯데리아)**. 26-1(돈까스도시락, 한솥)은 단가 비교용 보조.\n\n| 옵션 | 출처 | 단가 | 수량(25-2 기준) | 총액 | 장점 | 단점 |\n|---|---|---|---|---|---|---|\n| **불고기버거** (주 옵션) | 롯데리아 | 5,000원 | 140개 | 700,000원 | 단가↓, 호불호 적음 | 햄버거 호불호 일부 |\n| 돈까스 도시락 (보조 비교) | 한솥 | 5,200~6,000원 | 195 | 1,014,000원 | 풍성 | **한식 호불호, 남김** ← 26-1 피드백 |\n| 샌드위치 | 써브웨이 | - | - | - | 호불호 적음, 비건 가능 | 양 적음 |\n| 김밥/도시락 | - | - | - | - | 가벼움 | 영양 편중 |\n\n> 🔴 **비건 메뉴 필수**\n> - 25-2(주): **배지샐러드(서브웨이) 7,100원 × 10개 = 71,000원**\n> - 26-1(보조): 포케 10,900원 × 10개 (poke all day)\n>\n> 🔴 **피드백 (26-1 출처)**: \"한식 안 익숙한 교환 많음\" → 돈까스도시락 남김 발생.\n> 따라서 25-2의 불고기버거(롯데리아) 방식이 이번 26-2(율전)에 더 적합."},{"id":"d6-단체티-89-신규-전제-리드타임-확인-시안수량은-93-이후","title":"D6. 단체티 (🟡 8/9 신규 전제 + 리드타임 확인 / ⚪ 시안·수량은 9/3 이후)","order":10,"content_md":"## D6. 단체티 (🟡 8/9 신규 전제 + 리드타임 확인 / ⚪ 시안·수량은 9/3 이후)\n> ⚠️ **이번 26-2는 컨셉 변경(인사이드아웃)으로 신규 제작 전제.**\n> 잔여 마리오 티는 26-1 배부 후 회수 미비로 사실상 파악 불가 → 재활용 옵션 배제.\n> 25-2(신규 158장)를 현실적 기준으로 삼되, 수량은 9/3 팀 배정 후 확정."},{"id":"주-기준-252-신규-제작","title":"주 기준 (25-2, 신규 제작)","order":11,"content_md":"## 주 기준 (25-2, 신규 제작)\n- **신규 158장 = 하클 49 + 교환 88 + 추가 21**\n- 단가 **12,400원/장** (탑앤탑)\n- **총액 2,063,200원** ← 예산 최대 단일 항목(천막과 함께)\n- 26-2 수량은 교환 약 150명 + 하클 약 48명 기준 추정 (9/3 팀 배정 후 확정)"},{"id":"4-과거-기록-참고","title":"4. 과거 기록 참고","order":12,"content_md":"## 4. 과거 기록 참고\n> 💡 **예산 기획의 주 기준은 25-2(율전/9월/단체티 신규)** — 이번 26-2와 예산 구조가 사실상 동일.\n> 26-1(명륜/5월)은 단체티 재활용 + 국제처 천막 지원으로 흑자 달성한 특수 케이스라 **예산 기준 부적절**. 단, 단가 비교용으로는 유효."},{"id":"5-과거-예산-실적-252-주-261-보조","title":"5. 과거 예산 실적 (25-2 주, 26-1 보조)","order":13,"content_md":"## 5. 과거 예산 실적 (25-2 주, 26-1 보조)\n> 💡 **예산 시뮬레이션은 25-2 적자 구조(-475,320원)를 출발점으로 시작할 것.**\n> - 주 상세 데이터: 25-2 (이번 26-2와 동일 구조: 율전/9월/단체티 신규/천막 업체대여)\n> - 보조 단가 비교: 26-1 (명륜/5월/재활용 → 흑자 특수 케이스)\n>\n> ⚠️ **시뮬레이션은 8/16(컨텐츠 완성) 이후 본격화**: 8/9 2차 회의에서는 \"방향(옵션)\"만 다루고,\n> 단가 시뮬레이션·총액 산출은 컨텐츠팀 물품 리스트 수령(8/16) 후 진행한다.\n\n---"},{"id":"51-252-2025-가을-율전-주-기준","title":"5-1. 25-2 (2025 가을, 율전) — 주 기준 ★","order":14,"content_md":"## 5-1. 25-2 (2025 가을, 율전) — 주 기준 ★\n상세: `../25 스포츠데이 참고용 자료/[2025_Fall_Sports Day] 최종기획안 및 인원관리표.xlsx`"},{"id":"총괄","title":"총괄","order":15,"content_md":"## 총괄\n| 항목 | 금액 |\n|---|---|\n| 총 지출 | **4,387,520원** |\n| 수입(입장료) | 1,500,000원 (15,000원 × 약 100명) |\n| **적자(동아리 보전)** | **475,320원** |"},{"id":"주요-항목별-단가수량","title":"주요 항목별 단가/수량","order":16,"content_md":"## 주요 항목별 단가/수량\n| 품목 | 단가 | 수량 | 총액 | 비고 |\n|---|---|---|---|---|\n| **단체티(신규)** | **12,400** | **158** | **2,063,200** | 탑애탑 (하클49+교환88+추가21) |\n| **천막** | - | 10 | **550,000** | 게임연구소 (배송포함) ← 26-1과 처리 방식 상이 |\n| 불고기버거 | 5,000 | 140 | 700,000 | 롯데리아 |\n| 비건 배지샐러드 | 7,100 | 10 | 71,000 | 서브웨이 |\n| 물/음료 | - | - | 303,380 | 탐사수400+토레타160+포카리160 |\n| 간식 | - | - | 186,860 | 에너지바+피크닉제로+비건고구마스틱 |\n| 뽑기상품 | - | - | 132,000 | 필름카메라2+달고나+별뽀빠이+약과+신쫄이+사탕 |\n| 우승상품 | - | - | 120,810 | 메달30+트로피+부채20 |\n| 게임용품 렌탈 | - | - | 93,500 | 게임연구소 |\n| 아이스박스 | - | 4 | 52,800 | - |\n| 림보세트 | - | - | 21,590 | - |\n| 페이스페인팅 | - | - | 22,900 | - |\n| 바통 | - | - | 16,000 | - |\n| 양은냄비 | - | - | 10,250 | - |\n| 딱지 | - | - | 8,900 | - |\n| 꼬리세트 | - | - | 6,730 | - |\n\n---"},{"id":"52-261-2026-봄-명륜-보조-비교용","title":"5-2. 26-1 (2026 봄, 명륜) — 보조 비교용","order":17,"content_md":"## 5-2. 26-1 (2026 봄, 명륜) — 보조 비교용\n상세: `../../26-1 Sports Day/예산팀/26-1 Sports Day 예산안.xlsx`"},{"id":"총괄-특수-단체티-재활용-국제처-천막-지원-흑자","title":"총괄 (특수: 단체티 재활용 + 국제처 천막 지원 → 흑자)","order":18,"content_md":"## 총괄 (특수: 단체티 재활용 + 국제처 천막 지원 → 흑자)\n| 항목 | 금액 |\n|---|---|\n| 총 지출 | 3,176,048원 |\n| 수입(입장료 등) | 약 1,950,000원 (15,000원 × 약 130명) |\n| **흑자** | **516,952원** ← 재활용/외부지원 때문, 이번 26-2와 구조 상이 |"},{"id":"주요-항목별-단가수량","title":"주요 항목별 단가/수량","order":19,"content_md":"## 주요 항목별 단가/수량\n| 품목 | 단가 | 수량 | 총액 | 비고 |\n|---|---|---|---|---|\n| 돈까스 도시락 | 5,200~6,000 | 195 | 1,014,000 | 한솥 (26-1 피드백: 한식 호불호) |\n| 포케(비건) | 10,900 | 10 | 109,000 | poke all day |\n| **천막** | - | - | **1,360,000** | 국제처 섭외 (예산 外) ← 25-2와 처리 방식 상이 |\n| 게임용품 대여 | - | - | 98,000 | 게임연구소 |\n| 아이스박스 대여 | 12,000 | 2~3 | 24,000~36,000 | 게임연구소 |\n| 탐사수 500ml | - | 400 | 74,980 | 쿠팡 |\n| 토레타 340ml | - | 160 | 110,840 | 쿠팡 |\n| 포카리 340ml | - | 160 | 117,200 | 쿠팡 |\n| **단체티(추가만)** | **12,400** | **50** | **620,000** | 탑애탑 (재활용 추가분 only) |\n| 뽑기상품(1~5등) | - | - | ~70,000 | 달고나/발포/약과/신쫄이/사탕 |\n| 색깔판 세트 | 6,800 | 4 | 27,200 | 네이버 |\n| 물총 세트 | 5,200 | 3 | 15,600 | 쿠팡 |\n\n> ⚠️ **비교 포인트**\n> - **천막**: 25-2(게임연구소 10개 55만) vs 26-1(국제처 136만, 예산 外) → 이번 26-2는 25-2 방식(게임연구소) 전제\n> - **단체티**: 25-2(신규 158장 206만) vs 26-1(추가 50장 62만) → 이번 26-2는 컨셉 변경으로 25-2 방식(신규) 전제\n> - **식사**: 25-2(불고기버거 5,000원) vs 26-1(돈까스도시락 5,200~6,000원) → 단가·호불호 모두 25-2 우위\n\n---"},{"id":"6-준비물-리스트-관리-상시-갱신","title":"6. 준비물 리스트 관리 (상시 갱신)","order":20,"content_md":"## 6. 준비물 리스트 관리 (상시 갱신)\n> 상태: **주문 전 → 배송 중 → 배송 완료 → 브룸(비치)**"},{"id":"상태-추적표","title":"상태 추적표","order":21,"content_md":"## 상태 추적표\n| 품목 | 개수 | 출처 | 상태 | 비고 |\n|---|---|---|---|---|\n| | | | 주문전/배송중/완료/브룸 | |"},{"id":"출처별-분류-252-주-261-보조","title":"출처별 분류 (25-2 주, 26-1 보조)","order":22,"content_md":"## 출처별 분류 (25-2 주, 26-1 보조)\n| 출처 | 예시 품목 | 비고 |\n|---|---|---|\n| **브룸**(동아리 방) | 피구공, 제기, 공기세트, 추첨박스, 수금통, 돗자리, 티셔츠 잔여 | |\n| **게임연구소**(렌탈) | 밧줄, 색깔판, 바통, 결승테이프, 콘, 아이스박스, **천막 10개(25-2)** | 25-2 천막 55만 |\n| **시설관리팀**(학교) | 천막(2), 의자, 테이블, 스피커, 마이크 | |\n| **업체 대여** | 천막(10) - 국제처 섭외(26-1, 예산 外 136만) | 26-1 방식 |\n| **총학** | 돗자리 | |\n| **쿠팡/네이버**(구매) | 물, 음료, 간식, 테이프, 소품류 | |\n\n---"}]}'::jsonb) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en, color=EXCLUDED.color, icon=EXCLUDED.icon, mission=EXCLUDED.mission, guideline_doc=EXCLUDED.guideline_doc;
INSERT INTO public.teams (id, name, name_en, color, icon, sort_order, mission, guideline_doc) VALUES ('exchange', '교환담당팀', 'Exchange', '#f59e0b', 'Users', 3, '구글폼, 참여자 명단, 교환 팀 배정, 카드뉴스 인계물', '{"sections":[{"id":"1-팀-미션-산출물","title":"1. 팀 미션 & 산출물","order":0,"content_md":"## 1. 팀 미션 & 산출물\n"},{"id":"미션","title":"미션","order":1,"content_md":"## 미션\n- 교환학생 대상 구글폼 제작 (25-2 주 양식 기반)\n- 정원 초과 시 추가 접수(Extra Registration) 시스템 운영\n- 폼 마감 후 응답 수합, 참여자 명단 정리\n- 교환 팀 배정\n- 카드뉴스 인계물(25-2 영문 17슬라이드 → 인사이드아웃 각색) 제작"},{"id":"주요-산출물-일정","title":"주요 산출물 & 일정","order":2,"content_md":"## 주요 산출물 & 일정\n- [ ] 구글폼 완성 (25-2 15문항 기준) — **8/20**\n- [ ] 교환학생 구글폼 접수 마감 — **8/28**\n- [ ] 추가 접수(Extra Registration) 필요성 판단/개설 — 8/28 이후\n- [ ] 카드뉴스 홍보부 인계 — 8/18\n- [ ] 카드뉴스 업로드 — 8/27\n- [ ] 컨텐츠 안내 홍보부 인계 — 8/30\n- [ ] **교환 팀 배정 완료** — **9/3**\n- [ ] 교환학생 정보방 개설 — 9/4\n- [ ] 컨텐츠 안내 카드뉴스 업로드 — 9/7"},{"id":"타-팀과의-연계","title":"타 팀과의 연계","order":3,"content_md":"## 타 팀과의 연계\n| 받을 정보 | 제공 팀 | 시기 |\n|---|---|---|\n| 게임 종류 (카드뉴스용) | 컨텐츠팀 | 컨텐츠 확정 후 |\n| 전반적 타임라인 | 타임라인팀 | 8/13 이후 |\n| 식사/단체티 정보 | 예산팀 | 컨텐츠 확정 후 |\n| 팀 개수(D2)/팀명(D3) | 기획관리팀 | 팀 배정 전 |\n\n| 제공 정보 | 받는 팀 | 시기 |\n|---|---|---|\n| 교환 팀 배정 결과 | 타임라인팀(하클 배치용) | 9/3 |\n| 교환 팀 배정 결과 | 예산팀(단체티 수량) | 9/3 |\n| 참여 인원 확정 | 예산팀(식사 수량) | 8/28 이후 |\n\n---"},{"id":"2-과거-기록-참고","title":"2. 과거 기록 참고","order":4,"content_md":"## 2. 과거 기록 참고\n> 💡 **25-2(율전·9월)를 주 템플릿으로 채택.** 26-2와 같은 장소(율전)·같은 시기(9월)·같은 버스 구조(명륜→율전)라 구글폼 출발지 항목과 카드뉴스 뼈대가 그대로 계승됨. 26-1(명륜)은 출발지 방향이 반대라 보조 자료로만 활용."},{"id":"21-252-2025-가을-율전-주-템플릿","title":"2-1. 25-2 (2025 가을, 율전) — **주 템플릿** ⭐","order":5,"content_md":"## 2-1. 25-2 (2025 가을, 율전) — **주 템플릿** ⭐\n> 26-2와 동일한 율전 9월 행사. 구글폼 15문항·안내문 PDF·추가접수폼의 주 양식.\n\n| 자료 | 경로 | 참고점 |\n|---|---|---|\n| **25-2 안내(PDF)** | `../25 스포츠데이 참고용 자료/25-2 Sports Day (교환용).pdf` | **교환학생 배포용 안내문 주 양식** (Details/Schedule/Fee/Notes/SafetyRules/구글폼 링크) |\n| 25-2 구글폼(15문항) | 안내문(PDF) 내 링크 | **구글폼 항목 주 양식** (본 지침 §3) |\n| **25-2 추가접수폼** | `../25 스포츠데이 참고용 자료/25-2 Sports Day Extra Registration (교환용).docx/pdf` | **추가 접수 시스템 양식** (본 지침 §3-2) |\n| 25-2 홍보부 인계물 | `../25 스포츠데이 참고용 자료/[2025_Fall_...]홍보부 인계물(게임 룰 종합).docx` | 카드뉴스 양식 (마리오 컨셉 영문 17슬라이드) |\n\n**25-2 기본 정보 (26-2 베이스라인)**\n- 교환학생 **100명**, **5팀**(마리오 컬러 YELLOW/PINK/GREEN/BLUE/PURPLE), 팀당 약 20명\n- 구글폼 15문항 (세부 항목은 §3 참조)\n- 추가 접수 21명 (정원 초과 시 선착순)\n- 명륜(Seoul Campus) → 율전 버스 80석 운영"},{"id":"23-기타-2025년-자료-디자인-참고","title":"2-3. 기타 2025년 자료 — 디자인 참고","order":6,"content_md":"## 2-3. 기타 2025년 자료 — 디자인 참고\n| 자료 | 경로 | 참고점 |\n|---|---|---|\n| 25-1 카드뉴스 | `../25 스포츠데이 참고용 자료/[2025_Spring_...]홍보부 인계물(카드뉴스).docx` | 카드뉴스 디자인 비교용 |\n| 25-1 토너먼트 안내 | `../25 스포츠데이 참고용 자료/[2025_Spring_...]홍보부 인계물(토너먼트).docx` | 토너먼트 안내 양식 |\n| 25-1 미니게임 안내 | `../25 스포츠데이 참고용 자료/[2025_Spring_...]홍보부 인계물(미니게임).docx` | 미니게임 안내 양식 |\n\n> 활용 팁: 구글폼·추가접수·안내문은 25-2 주 양식을 그대로 복사 후 인사이드아웃 컨셉으로 각색. 카드뉴스 디자인은 25-1/25-2/26-1 세 버전 비교 후 선택.\n\n---"},{"id":"3-구글폼-제작-820-완성","title":"3. 구글폼 제작 (8/20 완성)","order":7,"content_md":"## 3. 구글폼 제작 (8/20 완성)\n"},{"id":"주-양식-252-율전9월-구글폼-15문항","title":"주 양식: 25-2 (율전·9월) 구글폼 15문항","order":8,"content_md":"## 주 양식: 25-2 (율전·9월) 구글폼 15문항\n> 출처: `../25 스포츠데이 참고용 자료/25-2 Sports Day (교환용).pdf` 내 구글폼 링크\n> 26-2도 율전 9월 행사라 **출발지(Departure Location) 방향이 25-2와 동일(명륜→율전)**. 25-2 양식을 기본 복사 후 인사이드아웃 컨셉으로 각색."},{"id":"필수-수집-항목-252-기준-15문항","title":"필수 수집 항목 (25-2 기준 15문항)","order":9,"content_md":"## 필수 수집 항목 (25-2 기준 15문항)\n| # | 항목 | 25-2 | 26-2 | 비고 |\n|---|---|---|---|---|\n| 1 | Name | O | O | 영문명 |\n| 2 | Student ID | O | O | 학번 |\n| 3 | Email | O | O | 연락처 |\n| 4 | Instagram | O | O | SNS |\n| 5 | Kakao | O | O | 국내 연락 |\n| 6 | WhatsApp | O | O | 해외 연락 |\n| 7 | Korean Number | O | O | 체류 중 연락처 |\n| 8 | **Departure Location** | O | O | **Seoul Campus 버스(80석) / Suwon 직행** (25-2와 동일 방향: 명륜→율전) |\n| 9 | T-shirt Size | O | O | S / M / L / XL / 2XL / 3XL (단체티) |\n| 10 | 정보 정확성 확인 | O | O | 체크박스 동의 |\n| 11 | 신체장애 여부 (분기) | O | O | 안전 — Yes 분기 시 12번 노출 |\n| 12 | 신체장애 상세 | O | O | 11번 Yes일 때 |\n| 13 | 식이제한 여부 (분기) | O | O | Yes 분기 시 14번 노출 |\n| 14 | 식이제한 상세 | O | O | 13번 Yes일 때 (비건/할랄/알러지 등) |\n| 15 | 함께할 친구 이름 | O | O | 지인 요청 (팀 배정 참고) |\n\n> ⚠️ 25-2 폼에는 **성별 항목이 없었음** (26-1도 동일). 26-2는 §3-1에 따라 **16번 항목으로 성별 추가 (기본 포함, 결정 불필요)**."},{"id":"31-성별-항목-기본-포함-결정-불필요","title":"3-1. 성별 항목 — 기본 포함 (결정 불필요)","order":10,"content_md":"## 3-1. 성별 항목 — 기본 포함 (결정 불필요)\n> 26-1 피드백(\"구글폼에서 성별 꼭 받아야 할 듯. 스데는 성별이 중요\")을 반영해,\n> 이번 26-2 구글폼에는 **성별 항목을 기본 포함**한다. 결정 안건이 아니라 전제.\n\n- **기본 입장**: 16번 항목으로 **Gender (Male/Female/Prefer not to say)** 추가.\n  - 근거: 줄다리기(남6/여6), 계주(여3/남3) 등 종목별 성비 준수 필요\n  - 25-2/26-1의 이름·사진 수동 추정 워크플로우 폐지 → 오류 리스크 제거\n- **결정 불필요**: 8/9 2차 회의에서 결정하는 안건이 아님. 폼 제작(8/20) 시 기본 포함."},{"id":"32-추가-접수extra-registration-시스템-신규","title":"3-2. 추가 접수(Extra Registration) 시스템 ⭐ 신규","order":11,"content_md":"## 3-2. 추가 접수(Extra Registration) 시스템 ⭐ 신규\n> 정원(100명) 초과 시 **선착순 추가 모집** 운영. 25-2는 본 접수 마감 후 21명을 추가 모집했음.\n\n| 자료 | 경로 |\n|---|---|\n| **25-2 추가접수 양식** | `../25 스포츠데이 참고용 자료/25-2 Sports Day Extra Registration (교환용).docx/pdf` |\n\n- **운영 시점**: 본 구글폼 마감 후 수요가 정원 초과일 때\n- **양식**: 25-2 추가접수폼을 복사 후 26-2 정보로 갱신\n- **모집 인수**: 선착순 (25-2 기준 21명 — 26-2는 수요/버스 좌석에 따라 조정)\n- **체크리스트**:\n  - [ ] 본 접수 마감 후 대기 인원 집계\n  - [ ] 추가접수폼 개설 (25-2 양식 기반)\n  - [ ] 선착순 마감 안내 (버스 좌석 한도 사전 명시)\n  - [ ] 추가 인원 분리 명단 관리 (버스·티사이즈·식이제한 재확인)\n\n---"},{"id":"4-참여자-명단-관리","title":"4. 참여자 명단 관리","order":12,"content_md":"## 4. 참여자 명단 관리\n"},{"id":"산출물-작년-최종기획안-내-시트","title":"산출물 (작년: 최종기획안 내 시트)","order":13,"content_md":"## 산출물 (작년: 최종기획안 내 시트)\n- [ ] **스포츠데이 참여자 명단** (전체)\n- [ ] **명륜 버스 명단** (명륜→율전, 약 80명, 버스 2대 분할)\n- [ ] **교환 출석부 시트** (최종기획안에 작성)\n- [ ] **수금 현황** (입장료 수금 추적)"},{"id":"5-교환-팀-배정-93-완료","title":"5. 교환 팀 배정 (9/3 완료)","order":14,"content_md":"## 5. 교환 팀 배정 (9/3 완료)\n"},{"id":"배정-원칙-252-방식-주-기준","title":"배정 원칙 (25-2 방식 주 기준)","order":15,"content_md":"## 배정 원칙 (25-2 방식 주 기준)\n1. **성비 균형**: 각 팀 남/여 비율 균형 (줄다리기 5M/7F, 계주 3M/3F 기준)\n2. **출발 캠퍼스 혼합**: Seoul Campus(명륜 버스)/Suwon(직행) 비율 팀별 균형\n3. **지인 요청 반영**: 폼 15번 \"함께할 친구 이름\" 최대한 쌍방 매칭\n4. **식이제한 분산**: 비건/할랄/알러지 인원을 한 팀에 편중되지 않게 분산\n5. **티셔츠 사이즈**: 극단 사이즈(3XL 등)가 한 팀에 쏠리지 않게 (발주 편의)\n6. **국적 다양성**: 한 국적에 편중되지 않게\n7. **하클과 혼성 편성**: 각 팀에 하클 멤버 배치 (팀장 포함)"},{"id":"252-팀-구성-양식-참고-262는-6팀교환-약-150명으로-조정","title":"25-2 팀 구성 (양식 참고) — 26-2는 6팀/교환 약 150명으로 조정","order":16,"content_md":"## 25-2 팀 구성 (양식 참고) — 26-2는 6팀/교환 약 150명으로 조정\n> **25-2(참고)**: 5팀(마리오 컬러 YELLOW/PINK/GREEN/BLUE/PURPLE), 팀당 약 20명 (교환 100명 기준)\n> **26-2(이번)**: **6팀**(인사이드아웃 Joy/Sadness/Anger/Disgust/Fear/Anxiety), 팀당 약 25명 (교환 약 150명 기준)\n> 각 팀 Male/Female 컬럼 분리 관리 — 25-2의 컬러 분할 구조를 6팀으로 확장해 계승 권장"},{"id":"배정-후-인계","title":"배정 후 인계","order":17,"content_md":"## 배정 후 인계\n- [ ] 타임라인팀 → 하클 인원 배치용\n- [ ] 예산팀 → 단체티 수량용\n- [ ] 팀 편성 표 작성 (최종기획안 \"3. 팀별 편성\" 시트)\n\n---"},{"id":"6-카드뉴스-인계물-제작","title":"6. 카드뉴스 인계물 제작","order":18,"content_md":"## 6. 카드뉴스 인계물 제작\n"},{"id":"주-양식-252-영문-17슬라이드-마리오-컨셉-인사이드아웃-각색","title":"주 양식: 25-2 영문 17슬라이드 (마리오 컨셉) → 인사이드아웃 각색","order":19,"content_md":"## 주 양식: 25-2 영문 17슬라이드 (마리오 컨셉) → 인사이드아웃 각색\n> 출처: `../25 스포츠데이 참고용 자료/[2025_Fall_...]홍보부 인계물(게임 룰 종합).docx`\n> 25-2의 영문 17슬라이드 구성을 주 뼈대로 사용. **컨셉만 마리오 → 인사이드아웃으로 각색**, 슬라이드 구조/순서는 계승."},{"id":"제작-시점","title":"제작 시점","order":20,"content_md":"## 제작 시점\n- 컨텐츠 확정 후 → 컨텐츠 안내 카드뉴스\n- 타임라인/식사/단체티 정보 취합 후 → 종합 카드뉴스"},{"id":"포함-내용-252-안내문-pdf-17슬라이드-기준","title":"포함 내용 (25-2 안내문 PDF + 17슬라이드 기준)","order":21,"content_md":"## 포함 내용 (25-2 안내문 PDF + 17슬라이드 기준)\n> 안내문(PDF) 구성: Details / Schedule / Fee / Notes / SafetyRules / 구글폼 링크\n1. 행사 개요 Details (일시/장소/우천시)\n2. Schedule 타임라인\n3. Fee (참가비/포함 항목)\n4. 버스 탑승 안내 (명륜 Seoul Campus 출발 → 율전, 25-2와 동일 방향)\n5. 게임 종류 및 규칙 요약\n6. 식사 안내 (도시락/비건·식이제한)\n7. 단체티 안내 (사이즈 S~3XL)\n8. Notes / 준비물·복장\n9. SafetyRules (안전 수칙)\n10. 연락처 + 구글폼 링크\n\n> 26-1 카드뉴스(`../../26-1 Sports Day/교환담당팀/[2026_Spring_...]카드뉴스 초안.docx`)는 명륜 버전이라 출발 안내 방향이 반대 — 디자인 참고용으로만 활용.\n\n---"}]}'::jsonb) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en, color=EXCLUDED.color, icon=EXCLUDED.icon, mission=EXCLUDED.mission, guideline_doc=EXCLUDED.guideline_doc;
INSERT INTO public.teams (id, name, name_en, color, icon, sort_order, mission, guideline_doc) VALUES ('timeline', '타임라인/인원관리팀', 'Timeline', '#06b6d4', 'CalendarClock', 4, '전체 타임라인, 하클 인원 배치, 명륜 버스 운영', '{"sections":[{"id":"1-팀-미션-산출물","title":"1. 팀 미션 & 산출물","order":0,"content_md":"## 1. 팀 미션 & 산출물\n"},{"id":"미션","title":"미션","order":1,"content_md":"## 미션\n- 전체 행사 타임라인 구성 (**25-2 율전 템플릿 직접 차용**)\n- **하클 인원 배치** (메인 업무, 25-2 역할 분류 기준: 상주/게임별, 1부·2부 교차)\n- **명륜→율전 버스 운영 + 이중 집합 체계 + 귀환 셔틀** (25-2 직접 기준)"},{"id":"주요-산출물-일정","title":"주요 산출물 & 일정","order":2,"content_md":"## 주요 산출물 & 일정\n- [ ] 타임라인 완성 — **8/13** (25-2 타임라인 골격 그대로 적용 후 26-2 세부 조정)\n- [ ] 하클 가용인원 조사 — **8/17**\n- [ ] 하클 인원 배치표 (교환 팀 배정 후)\n- [ ] 명륜→율전 버스 운영 계획서 (이중 집합 포함)\n- [ ] 행사 당일 타임라인·인원관리표 (최종기획안 \"2. 타임라인 & 인원관리표\" 시트)"},{"id":"타-팀과의-연계","title":"타 팀과의 연계","order":3,"content_md":"## 타 팀과의 연계\n| 받을 정보 | 제공 팀 | 시기 |\n|---|---|---|\n| 교환 팀 배정 결과 | 교환담당팀 | 9/3 |\n| 게임 종류·소요시간 | 컨텐츠팀 | 8/16 이후 |\n| 전체 일정 | 기획관리팀 | - |\n| 버스 탑승 명단 (명륜조) | 교환담당팀 | 행사 1주일 전 |\n\n| 제공 정보 | 받는 팀 | 시기 |\n|---|---|---|\n| 전체 타임라인 | 교환담당팀(카드뉴스용) | 8/13 이후 |\n| 하클 배치표 | 전체 | 팀 배정 후 |\n| 버스 탑승 안내 (명륜조용) | 교환담당팀 | 행사 1주일 전 |"},{"id":"2차-회의89에서-할-일-타임라인팀","title":"2차 회의(8/9)에서 할 일 — 타임라인팀","order":4,"content_md":"## 2차 회의(8/9)에서 할 일 — 타임라인팀\n> 💡 8/9 회의는 \"방향 점검\" 회의. 타임라인팀은 **8/13 타임라인 완성(회의 후 4일)의 유일한 조율 기회**를 여기서 갖는다.\n\n- [ ] 🟡 **사전 준비**: 25-2 타임라인 베이스를 복사해 26-2 초안 베이스 준비\n- [ ] 🟡 **회의에서 (핵심 핸드오프)**: 컨텐츠팀의 게임 12종 \"방향\"(1-A 발표)을 수령\n  - 게임 종류가 정해져야 1부/2부 소요시간 베이스를 그릴 수 있음\n  - 컨텐츠팀 상세 소요시간은 8/16 이후 확정 → 그 전까지는 **25-2 소요시간을 임시값**으로 사용\n- [ ] 🟡 **회의에서**: 8/13 타임라인 완성 산출물의 **범위 합의** (어디까지 완성할지)\n- [ ] ⚪ **보류**: 상세 소요시간(8/16 컨텐츠 완성 후), 하클 배치표(8/17 인원조사 후)\n\n---"},{"id":"2-과거-기록-참고","title":"2. 과거 기록 참고","order":5,"content_md":"## 2. 과거 기록 참고\n> 💡 타임라인·하클 배치·버스 운영 기획 시 과거 기록을 적극 참고. 검증된 동선·역할 분담 계승.\n> **이번 26-2는 구조상 25-2와 거의 동일** → 25-2가 주 템플릿, 26-1은 보조."},{"id":"21-252-2025-가을-주-템플릿-직접-차용","title":"2-1. ⭐ 25-2 (2025 가을) — 주 템플릿 (직접 차용)","order":6,"content_md":"## 2-1. ⭐ 25-2 (2025 가을) — 주 템플릿 (직접 차용)\n> **25-2 = 명륜→율전 버스 + 이중 집합(명륜조/율전조) + 귀환 셔틀** = 이번 26-2와 **동일 구조**.\n> 타임라인 팀은 **25-2를 1차 베이스로 그대로 복사 후 26-2 세부 조정**하는 방식으로 작업.\n> 26-1(명륜 단일 집결)은 버스·이중집합·셔틀이 없어 **이 팀 관점에서는 거의 참고 가치 없음**.\n\n| 자료 | 경로 | 참고점 |\n|---|---|---|\n| **25-2 최종기획안** | `../25 스포츠데이 참고용 자료/[2025_Fall_...]인원관리표.xlsx` | **타임라인 & 인원관리표 시트** (율전 기준) — 하클 48명 배치, 역할 분류(상주/게임별, 1부2부 교차), 이중 집합, 버스 23명 인력 소모, 귀환 셔틀 |\n| 25-1 체크리스트 | `../25 스포츠데이 참고용 자료/25-1 Sports Day 체크리스트.xlsx` | 행사 당일 진행 체크리스트 (보조) |\n\n**25-2에서 직접 차용할 핵심 (이번 26-2의 뼈대)**\n- 이중 집합 체계: **명륜조(09:30 국제관 L 집합)** + **율전조(09:00 대운동장 도착, 선행 세팅)**\n- 명륜→율전 버스 동선 (10:30 출발 / 12:00 전 율전 도착)\n- 율전조가 명륜조보다 **1~1.5시간 선행** 세팅\n- 귀환 셔틀 (18:30 율전→명륜)\n- 하클 48명 역할 분류 + 버스 인력 23명 별도 소모\n\n> 💡 **25-2 회의 패턴 (1~4차) 인사이트** — 우리 26-2 흐름과 비교\n> - 25-2는 **2차 회의에서 종목 확정·컨셉 결정**, **3차에서 타임라인 outline 확정** 흐름으로 진행.\n> - 우리 26-2도 **2차(8/9) → 8/13 타임라인 완성** 흐름으로 25-2와 정합.\n> - 즉, 8/13 타임라인 완성 마일스톤은 25-2 검증된 일정 감각. 컨텐츠팀 8/16 게임 소요시간 수령 전까지는 25-2 종목 소요시간을 임시값으로 사용."},{"id":"22-261-2026-봄-보조-명륜-단일-집결-참고-가치-제한적","title":"2-2. 26-1 (2026 봄) — 보조 (명륜 단일 집결, 참고 가치 제한적)","order":7,"content_md":"## 2-2. 26-1 (2026 봄) — 보조 (명륜 단일 집결, 참고 가치 제한적)\n> 컨셉: 마리오 / **명륜 대운동장** / 5팀\n> ⚠️ **명륜 단일 집결**이라 버스·이중집합·귀환 셔틀이 없었음 → **타임라인 팀 관점에서는 거의 무의미**.\n> 점수 집계 양식·사회자 피드백 등 \"장소 무관한 운영 노하우\"만 참고.\n\n| 자료 | 경로 | 참고점 (제한적) |\n|---|---|---|\n| 최종기획안 | `../../26-1 Sports Day/[2026_Spring_...]인원관리표.xlsx` | 점수 집계 운영 양식, 사회자 역할 피드백 (장소 무관) |\n| 점수 집계 | `../../26-1 Sports Day/점수 집계팀.xlsx` | 점수 집계 운영 양식 |\n\n> 활용 원칙: **타임라인·버스·이중집합 = 25-2 우선** / 점수집계 양식·세부 운영 노하우 = 26-1 보조 참고.\n\n---"},{"id":"3-행사-당일-타임라인-뼈대-252-율전-기준-직접-차용","title":"3. 행사 당일 타임라인 뼈대 (25-2 율전 기준, 직접 차용)","order":8,"content_md":"## 3. 행사 당일 타임라인 뼈대 (25-2 율전 기준, 직접 차용)\n"},{"id":"1차-회의에서-확정된-구조-252와-동일","title":"1차 회의에서 확정된 구조 (25-2와 동일)","order":9,"content_md":"## 1차 회의에서 확정된 구조 (25-2와 동일)\n```\n(율전조 사전 세팅 — 명륜조 버스 도착 전 완료)\n  → 명륜 버스 도착 즉시 입장수속 + 점심 + 단체티 배부\n  → 개회 + 국민체조\n  → 1부: 토너먼트 2개 + 미니게임 부스 3개 + 메인게임 1개\n  → 휴식\n  → 2부: 토너먼트 2개 + 미니게임 부스 3개 + 메인게임 1개\n  → 시상·폐회\n  → 하클 뒷정리 → 귀환 셔틀\n```"},{"id":"252-타임라인-주-템플릿-262-베이스로-그대로-차용","title":"25-2 타임라인 (주 템플릿 — 26-2 베이스로 그대로 차용)","order":10,"content_md":"## 25-2 타임라인 (주 템플릿 — 26-2 베이스로 그대로 차용)\n> 상세: `../25 스포츠데이 참고용 자료/[2025_Fall_...]인원관리표.xlsx` 시트 \"2. 타임라인 & 인원관리표\""},{"id":"오전-이중-집합-명륜조-율전조-분리","title":"오전 — 이중 집합 (명륜조 / 율전조 분리)","order":11,"content_md":"## 오전 — 이중 집합 (명륜조 / 율전조 분리)\n| 시간 | 내용 | 비고 |\n|---|---|---|\n| **[명륜조]** 09:30 | 국제관 L 집합 | 명륜 출발조 |\n| **[명륜조]** 10:00~10:30 | 버스 탑승 안내 (600주년 기념관 앞) | 상차 6 + 탑승안내 10 |\n| **[명륜조]** 10:30 | 명륜 출발 | 버스 2대 |\n| **[명륜조]** 12:00 | 전 율전 도착 | 대운동장 |\n| **[율전조]** 09:00 | 대운동장 도착 (천막 수령, **가장 먼저**) | 선행 세팅조 |\n| **[율전조]** 10:00 | 출석체크 | 명륜조보다 1~1.5시간 선행 |\n| **[율전조]** 10:00~ | 세팅 시작 | 명륜 버스 도착 전 완료 |"},{"id":"10301150-경기장-준비-율전조-주도-명륜조-도착-전-완료","title":"10:30~11:50 경기장 준비 (율전조 주도, 명륜조 도착 전 완료)","order":12,"content_md":"## 10:30~11:50 경기장 준비 (율전조 주도, 명륜조 도착 전 완료)\n| 순위 | 항목 | 구성 |\n|---|---|---|\n| **최우선** | 입장관리존 | 천막 2 + 테이블 3 + 의자 8 + 노트북 4 |\n| | 경기장 본구역 | 60m × 40m 콘 구역 |\n| | 미니게임천막 | 3동 |\n| | 팀대기존 | 천막 1 + 돗자리 2 |\n| | 본부 | 천막 2 |"},{"id":"1115-점심-수령","title":"11:15 점심 수령","order":13,"content_md":"## 11:15 점심 수령\n- **하클 먼저** 수령 (행사 직전 식사)"},{"id":"11501250-입장-점심-단체티-배부-명륜-버스-도착-즉시-인솔","title":"11:50~12:50 입장 + 점심 + 단체티 배부 (명륜 버스 도착 즉시 인솔)","order":14,"content_md":"## 11:50~12:50 입장 + 점심 + 단체티 배부 (명륜 버스 도착 즉시 인솔)\n- 명륜 버스 도착 즉시 인솔 개시\n- **3단계 입장수속**: (1) 체크 → (2) 사이즈기록 → (3) 단체티 배부"},{"id":"개회","title":"개회","order":15,"content_md":"## 개회\n| 시간 | 내용 | 비고 |\n|---|---|---|\n| 12:50~13:00 | 개막 전 선수 입장 | |\n| 13:00~13:30 | 개회 + 국민체조 | K-pop BGM 팀별 입장 |"},{"id":"본행사","title":"본행사","order":16,"content_md":"## 본행사\n| 시간 | 내용 | 비고 |\n|---|---|---|\n| **1부** 13:30~15:15 | 토너먼트 2 + 미니게임 3 + 메인게임 1 | |\n| **휴식** 15:15~15:45 | | |\n| **2부** 15:50~17:35 | 토너먼트 2 + 미니게임 3 + 메인게임 1 | |"},{"id":"폐회-귀환","title":"폐회 & 귀환","order":17,"content_md":"## 폐회 & 귀환\n| 시간 | 내용 | 비고 |\n|---|---|---|\n| 17:35~18:00 | 시상 / 폐회 | |\n| 18:00~ | 하클 뒷정리 | |\n| **18:30** | **율전→명륜 귀환 셔틀** | 수성관 5동 & 주차장 사이, N센터 앞 |\n\n> ⚠️ 26-2 적용 시 조정 포인트\n> - 위 타임라인은 25-2 검증값. **컨텐츠팀 게임 소요시간(8/16 이후) 확정 후 1부/2부 시간 미세조정**.\n> - 명륜 집합 장소(국제관 L), 버스 탑승지(600주년 기념관 앞), 귀환 셔틀 위치(수성관 5동 & 주차장 사이, N센터 앞)는 26-2 현황에 맞춰 재확인.\n\n---"},{"id":"4-명륜율전-버스-운영-252-직접-기준-이번-핵심","title":"4. 명륜→율전 버스 운영 (25-2 직접 기준 — 이번 핵심)","order":18,"content_md":"## 4. 명륜→율전 버스 운영 (25-2 직접 기준 — 이번 핵심)\n> 25-2의 이중 집합 체계·버스 동선·귀환 셔틀·**버스 인력 23명 소모**를 그대로 기준으로 삼는다."},{"id":"44-버스-인력-소모-252-기준-23명","title":"4-4. 버스 인력 소모 (25-2 기준 23명)","order":19,"content_md":"## 4-4. 버스 인력 소모 (25-2 기준 23명)\n> 🔴 버스 운영만으로 **23명의 하클 인력이 소모**됨. 하클 48명(§5) 중 거의 절반 가까이 버스에 묶임.\n> **배치 시 이 23명은 ''율전 본행사 상주 역할''과 중복 불가** → 인력 풀 분리 필수.\n\n| 시간대 | 역할 | 인원 | 계 |\n|---|---|---|---|\n| **오전** | 물품 상차 | 6 | 16 |\n| | 탑승 안내 | 10 | |\n| **오후** | 물품 상차 | 3 | 7 |\n| | 탑승 안내 | 4 | |\n| **합계** | | | **23명** |\n\n> 참고: 오전 16명 + 오후 7명 = 23명 (일부 인원 오전/오후 겹침 가능하나, 안전 마진 포함)."},{"id":"5-하클-인원-배치-메인-업무-252-역할-분류-주-기준","title":"5. 하클 인원 배치 (메인 업무 — 25-2 역할 분류 주 기준)","order":20,"content_md":"## 5. 하클 인원 배치 (메인 업무 — 25-2 역할 분류 주 기준)\n> 25-2 기준 **하클 48명**. 역할 분류(상주/게임별, 1부·2부 교차)를 주 기준으로 삼는다.\n> **버스 인력 23명(§4)은 별도 풀** — 본행사 상주 역할과 중복 배정 불가."},{"id":"51-역할-분류-252-기준","title":"5-1. 역할 분류 (25-2 기준)","order":21,"content_md":"## 5-1. 역할 분류 (25-2 기준)\n| 역할 | 내용 | 상주/게임별 | 비고 |\n|---|---|---|---|\n| **사회자** | 1부/2부 교차 진행 | 상주 | 영어 편한 사람 (26-1 피드백 계승) |\n| **심판** | 게임별 배정 | 게임별 | 게임당 1~2명 |\n| **점수 집계** | 본부 총괄 | 상주 | **노트북 필수** |\n| **팀장** | 팀별 1명 (**6팀 → 6명**, 고정) | 팀 소속 | 교환과 함께 상주 |\n| **미니게임 도장뽑기** | 부스별 | 상시 | |\n| **물품 관리** | 물품 총괄 | 상주 | |\n| **부스 관리** | 부스 운영 보조 | 상시 | |\n| **페이스페인팅** | 부스 운영 | 상시 | |\n| **BGM** | 음악 담당 | 상주 | K-pop 팀별 입장, 국민체조 |\n| **국민체조 시범** | 개회 시범 | 1회 | 13:00~13:30 |"},{"id":"52-배치-원칙-252-기준","title":"5-2. 배치 원칙 (25-2 기준)","order":22,"content_md":"## 5-2. 배치 원칙 (25-2 기준)\n- **1부/2부 교차 배치**: 사회자 등 고강도 역할은 1부·2부 교차로 피로도 분산.\n- **상주 역할 vs 게임별 역할 분리**: 상주(본부/점수집계/물품/BGM)는 고정, 심판은 게임별 이동.\n- **심판은 게임별로 배정**: 컨텐츠팀과 협의하여 심판 수량 확정 (게임당 1~2명).\n- **팀장 6명은 고정**: 교환 팀 배정 결과(9/3) 수령 후 확정.\n- **버스 23명은 별도 풀**: §4 참조. 본행사 상주 역할과 중복 불가."},{"id":"53-하클-가용인원-표-양식-262-작성용","title":"5-3. 하클 가용인원 표 양식 (26-2 작성용)","order":23,"content_md":"## 5-3. 하클 가용인원 표 양식 (26-2 작성용)\n| 이름 | 1부 역할 | 2부 역할 | 버스 인력 여부 | 인원체크 |\n|---|---|---|---|---|\n\n> 컬럼 추가: **버스 인력 여부** (오전 상차/탑승안내, 오후 상차/탑승안내) — 25-2 교훈 반영.\n\n---"}]}'::jsonb) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en, color=EXCLUDED.color, icon=EXCLUDED.icon, mission=EXCLUDED.mission, guideline_doc=EXCLUDED.guideline_doc;

-- ===== decisions =====
INSERT INTO public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes) VALUES ('D1', '컨셉/행사명', ARRAY['인사이드아웃','미니언즈','어벤져스','해리포터','원피스','주토피아','월드컵','스폰지밥']::text[], 'confirmed', '인사이드아웃 / HI-Side Out', '2026-08-05'::date, 0, '1차 회의 검토 → 확정') ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, options=EXCLUDED.options, status=EXCLUDED.status, current_value=EXCLUDED.current_value, decision_date=EXCLUDED.decision_date, notes=EXCLUDED.notes;
INSERT INTO public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes) VALUES ('D2', '팀 개수', ARRAY['5팀(약 30명)','6팀(약 25명)']::text[], 'confirmed', '6팀', '2026-08-05'::date, 1, NULL) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, options=EXCLUDED.options, status=EXCLUDED.status, current_value=EXCLUDED.current_value, decision_date=EXCLUDED.decision_date, notes=EXCLUDED.notes;
INSERT INTO public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes) VALUES ('D3', '팀명/컬러', ARRAY['인사이드아웃: Joy','Sadness','Anger','Disgust','Fear','Anxiety']::text[], 'confirmed', 'Joy / Sadness / Anger / Disgust / Fear / Anxiety', '2026-08-05'::date, 2, '감정 6개 = 6팀과 일치') ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, options=EXCLUDED.options, status=EXCLUDED.status, current_value=EXCLUDED.current_value, decision_date=EXCLUDED.decision_date, notes=EXCLUDED.notes;
INSERT INTO public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes) VALUES ('D4', '입장료', ARRAY['1.3만원','1.5만원','기타']::text[], 'deferred', '보류: 동아리 보전 한도 파악 후 8/16~8/25 결정', NULL, 3, '25-2 기준 1.5만원 (가이드라인: 1학기 1.3만, 비건 옵션 필수)') ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, options=EXCLUDED.options, status=EXCLUDED.status, current_value=EXCLUDED.current_value, decision_date=EXCLUDED.decision_date, notes=EXCLUDED.notes;
INSERT INTO public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes) VALUES ('D5', '점심 메뉴', ARRAY['돈까스도시락','샌드위치','김밥','기타']::text[], 'discussing', '방향 논의: 8/9 2차 회의', NULL, 4, '25-2 기준: 불고기버거 (가이드라인: 2종 준비, 비건 필수)') ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, options=EXCLUDED.options, status=EXCLUDED.status, current_value=EXCLUDED.current_value, decision_date=EXCLUDED.decision_date, notes=EXCLUDED.notes;
INSERT INTO public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes) VALUES ('D6', '단체티', ARRAY['신규 제작 (인사이드아웃) — 재활용 배제 (잔여 티 26-1 회수 미비)']::text[], 'discussing', '방향 논의: 8/9 2차 회의 (신규 전제 + 리드타임 확인)', NULL, 5, '25-2 기준: 신규 158장 2,063,200원, 단가 12,400원 (탑앤탑). 수량은 9/3 팀 배정 후 확정') ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, options=EXCLUDED.options, status=EXCLUDED.status, current_value=EXCLUDED.current_value, decision_date=EXCLUDED.decision_date, notes=EXCLUDED.notes;
INSERT INTO public.decisions (id, title, options, status, current_value, decision_date, sort_order, notes) VALUES ('D7', '점수 배분 체계', ARRAY['팀 수에 따라 조정']::text[], 'pending', NULL, NULL, 6, '작년 5팀: 100/80/60/40/40') ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, options=EXCLUDED.options, status=EXCLUDED.status, current_value=EXCLUDED.current_value, decision_date=EXCLUDED.decision_date, notes=EXCLUDED.notes;

-- ===== milestones =====
DELETE FROM public.milestones;
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('335cc03b-1506-41ec-8c27-b01d748bcd3a', '2026-07-29'::date, '기획팀 1차 회의', NULL, 'meeting', true, NULL, 0);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('8c223166-4e3f-4b63-a702-471dcaed5acb', '2026-08-07'::date, '방중회의', NULL, 'meeting', true, NULL, 1);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('05e80dca-3781-4386-b44a-65e590be03d0', '2026-08-09'::date, '기획팀 2차 회의', NULL, 'meeting', false, NULL, 2);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('f1e800b0-2cd2-4d1e-961e-908a37375d32', '2026-08-21'::date, '방중회의', NULL, 'meeting', false, NULL, 3);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('769abcb4-b4b1-4165-ba22-d961231ac5a5', '2026-09-11'::date, '중간브리핑', NULL, 'meeting', false, NULL, 4);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('088ad703-2820-46d9-b5dd-cc87ff55ffca', '2026-09-18'::date, '최종브리핑', NULL, 'meeting', false, NULL, 5);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('4a9e7f46-b13c-440f-afb8-285283338898', '2026-09-19'::date, 'Sports Day', NULL, 'meeting', false, NULL, 6);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('6d445bf1-fb29-4e97-90c9-319c81806433', '2026-08-09'::date, '컨텐츠 방향성 뼈대 (게임 선종 후보·점수 철학 — 상세는 8/16)', 'content', 'deliverable', false, NULL, 7);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('11e1561a-c9d9-4fb4-bda8-bbb27d83a413', '2026-08-09'::date, '예산 방향 옵션 (단체티 신규 전제+리드타임 확인 / 점심 방향 — 입장료는 보전 한도 파악 후 8/16~8/25)', 'budget', 'deliverable', false, NULL, 8);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('8b316af3-9b1e-424c-87ed-93ba60d9abf9', '2026-08-13'::date, '타임라인 완성', 'timeline', 'deliverable', false, NULL, 9);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('574abb84-6290-49c0-ac64-2f346354473b', '2026-08-16'::date, '컨텐츠 완성', 'content', 'deliverable', false, NULL, 10);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('d98d89c3-50e8-4d85-a765-bd327d284199', '2026-08-17'::date, '하클 가용인원 조사', 'timeline', 'deliverable', false, NULL, 11);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('3f459a38-0242-41c3-adbf-eee8f8562fb4', '2026-08-18'::date, '카드뉴스 홍보부 인계', 'exchange', 'deliverable', false, NULL, 12);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('b3b447fa-fa83-4d90-85c0-3ad5cd619466', '2026-08-20'::date, '구글폼 완성', 'exchange', 'deliverable', false, NULL, 13);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('313c6967-1b39-4ae2-9170-efbec25a491d', '2026-08-25'::date, '최종기획안 완성 및 임원진 인계', 'management', 'deliverable', false, NULL, 14);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('f63fbaa4-cb7b-4e87-aabc-4f8217c1cd19', '2026-08-27'::date, '카드뉴스 업로드', 'exchange', 'deliverable', false, NULL, 15);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('5bad5e6b-20a2-4554-a862-27c549231c5f', '2026-08-28'::date, '교환학생 구글폼 접수 마감', 'exchange', 'deliverable', false, NULL, 16);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('6461433b-f463-4082-b909-fd721f929731', '2026-08-30'::date, '컨텐츠 안내 홍보부 인계', 'exchange', 'deliverable', false, NULL, 17);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('2307ed99-7f36-4969-b5e3-2123ef968fa8', '2026-08-31'::date, '최종기획안 국제처 인계', 'management', 'deliverable', false, NULL, 18);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('0e960487-b65d-4fe0-a876-c58a6799cb69', '2026-08-31'::date, '수금 부스', 'budget', 'deliverable', false, NULL, 19);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('8130cc5d-88c6-42d3-bcdc-329ec47824cf', '2026-09-03'::date, '교환 팀 배정 완료', 'exchange', 'deliverable', false, NULL, 20);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('ee855044-a221-49c0-bb97-5027db3ae01b', '2026-09-03'::date, '준비물 주문', 'budget', 'deliverable', false, NULL, 21);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('5417292e-5850-4ea8-940c-acc99f2c088b', '2026-09-04'::date, '단체티 주문', 'budget', 'deliverable', false, NULL, 22);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('7ef8ed20-b0e8-4109-83df-f76589def7cb', '2026-09-04'::date, '교환학생 정보방 개설', 'exchange', 'deliverable', false, NULL, 23);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('7b18667e-bab1-46be-8112-7aa53348985c', '2026-09-07'::date, '컨텐츠 안내 카드뉴스 업로드', 'exchange', 'deliverable', false, NULL, 24);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('e7e3e94f-52af-41d0-975d-30d36de1f289', '2026-09-10'::date, '최종기획안 공유 및 업무보고카톡', 'management', 'deliverable', false, NULL, 25);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('3e7e6006-2867-41e5-b023-3c75f7a382e5', '2026-09-17'::date, '업무보고 카톡 마감', 'management', 'deliverable', false, NULL, 26);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('80d4d35c-9b1d-4bd5-ac8c-ba80e2af016a', '2026-09-18'::date, '최종 브리핑', 'management', 'deliverable', false, NULL, 27);
INSERT INTO public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order) VALUES ('6c0a214f-9e96-48d0-8f07-6c969bb19ca8', '2026-09-19'::date, 'Sports Day', 'management', 'event', false, NULL, 28);

-- ===== checklist_items =====
DELETE FROM public.checklist_items;
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('754128ed-df14-4aee-8892-d0a04caf1e18', 'content', 'feedback', '심판 규칙 사전 숙지: 각 게임 규칙 문서화 → 최소 3일 전 심판 배정 → 오프라인 사전 리허설', 'high', false, NULL, 0);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('53d79cbd-b38c-45ad-9e13-8b4e3a79b8f6', 'content', 'feedback', '토너먼트 균형 배분: 1·2부에 줄다리기/피구/계주가 몰리지 않도록 분산', 'medium', false, NULL, 1);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('e24c5cbc-eabc-4877-9355-30269db00188', 'content', 'feedback', '미니게임 유도: 2부 미니게임 참여 유도 방안 (작년 한산)', 'medium', false, NULL, 2);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('c6bff0cd-4d76-4f05-92d8-10f41baaef35', 'content', 'feedback', '규칙 설명 더 명확히 + 반칙 시 패널티 규정 포함', NULL, false, NULL, 3);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('536b76df-6b20-453e-82d2-ed8523258a31', 'content', 'feedback', '토너먼트 2번째로 무궁화(26-1) 채택 시: 탈락자 선정에 물총 대신 뿅망치 (조준 애매)', NULL, false, NULL, 4);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('e821087a-90c3-4979-8ee1-6314234d4e2a', 'content', 'feedback', '페이스페인팅 유지', 'low', false, NULL, 5);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('939f0e15-b48b-4ca6-bdc5-b38428319f56', 'content', 'progress', '컨셉(D1)·팀 개수(D2) 수령', NULL, false, NULL, 6);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('f6429af2-863e-4166-a732-8f80a95548d1', 'content', 'progress', '토너먼트 4종 확정', NULL, false, NULL, 7);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('1630a01e-a68d-4cec-a1cb-211c190aff0b', 'content', 'progress', '메인게임 2종 확정', NULL, false, NULL, 8);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('56a4eab9-550e-4f40-9c1e-dab34fc8c815', 'content', 'progress', '미니게임 6종 확정', NULL, false, NULL, 9);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('ddbb10aa-7bab-446d-b6ea-ff247efee7dd', 'content', 'progress', '각 게임별 상세 시트 작성 (양식 §3)', NULL, false, NULL, 10);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('21f56dac-d5d3-4ef5-a3b7-18dacc9eb307', 'content', 'progress', '점수배분 체계 확정 (D2 종속)', NULL, false, NULL, 11);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('728a5f1a-3033-48b4-8e3b-7f7ec74f16b1', 'content', 'progress', '필요 물품 리스트 → 예산팀 인계', NULL, false, NULL, 12);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('35821fe8-64df-47c8-b17e-442e918ae15f', 'content', 'progress', '율전 대운동장 배치도 작성', NULL, false, NULL, 13);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('1a286c8b-1485-4e0f-8330-514f0a6ba064', 'content', 'progress', '심판 배정표 (최소 3일 전)', NULL, false, NULL, 14);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('8cc9ec56-98d1-4de3-8a94-d80d3b054e54', 'content', 'progress', '컨텐츠 안내 → 교환담당팀(카드뉴스) 인계', NULL, false, NULL, 15);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('e06dc6cf-b0d7-4bc0-b357-7232e1bd84f6', 'budget', 'progress', '8/9 회의에서 확인: 주문처(탑앤탑) 리드타임', 'medium', false, NULL, 0);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('25897d0b-3a6b-4948-960e-ac6414b6203f', 'budget', 'progress', '신규 제작 전제 (인사이드아웃 도안)', 'medium', false, NULL, 1);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('1bbdb684-4faa-4257-8648-2aea30eb1986', 'budget', 'progress', '시안(컨셉 연동)', NULL, false, NULL, 2);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('70bd13fd-75ce-4757-bca0-7c8e39723920', 'budget', 'progress', '수량(팀 배정 9/3 후) + 주문처(탑앤탑, 단가 12,400원)', NULL, false, NULL, 3);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('1e24a590-3830-4336-a008-7294ea272bc3', 'budget', 'feedback', '율전 브룸에 물품 미리 비치 (26-1: 명륜 브룸 부재로 당일 혼란)', 'high', false, '이번 26-2는 율전', 4);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('2b46ba62-60ca-4eb5-81b1-51c8b54cc13e', 'budget', 'feedback', '점심 호불호 적은 메뉴 검토 → 25-2 불고기버거(롯데리아) 방식 채택', 'medium', false, '26-1 돈까스도시락 호불호 피드백', 5);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('087b9546-52c4-44c7-8cc4-bfc0c16856b2', 'budget', 'feedback', '음식물 쓰레기통 별도 비치 + 사전 안내 (작년 분리수거 혼란)', 'medium', false, NULL, 6);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('57321bec-7814-4cde-9689-2c019d9d7103', 'budget', 'feedback', '비건 음식 지연 주의 (시간 여유)', 'medium', false, NULL, 7);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('91828980-44ed-4b47-b61a-0c85a6365ef3', 'budget', 'feedback', '중간 간식(에너지바, 핫바) 제공 검토', 'low', false, NULL, 8);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('70b5742e-b07e-45c0-969f-c5876a15feec', 'budget', 'feedback', '물총 교환학생 자유 사용 허용 검토', 'low', false, NULL, 9);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('961f82c9-1fbf-4219-87ae-79096b009ebd', 'budget', 'feedback', 'SG MAPLE(정규 교환) 챙기기', 'low', false, NULL, 10);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('92ce63d1-cfab-47f9-82b1-b72749864bf2', 'budget', 'progress', '단체티 방침(신규 전제) + 주문처 리드타임 확인 (D6, 8/9 회의)', 'medium', false, NULL, 11);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('cf501751-29c6-498f-b584-2a51e61de9c9', 'budget', 'progress', '점심 메뉴 방향 논의 (D5, 8/9 회의)', 'medium', false, NULL, 12);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('12ddc088-5491-4729-941f-180bfa96a336', 'budget', 'progress', '입장료 결정 (D4, 8/16~8/25 — 보전 한도 파악 후)', NULL, false, NULL, 13);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('37456e61-5177-4011-8a20-4689b050df54', 'budget', 'progress', '게임 물품 리스트 수령 (컨텐츠팀 8/16 완성 후)', NULL, false, NULL, 14);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('414bb4aa-2fbc-4c4e-b9e1-179c45557e20', 'budget', 'progress', '예산안 작성(단가·수량·총액)', NULL, false, NULL, 15);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('1dcde297-f2e3-4abc-8f7a-7a6b1e4b0ccc', 'budget', 'progress', '단체티 시안 (리드타임에 따라 8/16 이후 또는 즉시 착수)', NULL, false, NULL, 16);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('8772d8fb-4cdf-4083-a06a-83c010de8b84', 'budget', 'progress', '참여 인원 확정 후 식사 수량 조정 (8/28 이후)', NULL, false, NULL, 17);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('21fcb85c-fc51-4e6f-a975-d3d8b3a71a7d', 'budget', 'progress', '팀 배정 후 단체티 수량 확정 (9/3 이후)', NULL, false, NULL, 18);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('82117660-2793-437f-84a8-ad7964f4c593', 'budget', 'progress', '준비물 주문 (9/3)', NULL, false, NULL, 19);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('2a64be7d-38b2-4200-a20a-b816ec4b42a2', 'budget', 'progress', '단체티 주문 (9/4)', NULL, false, NULL, 20);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('b583f3d6-77ff-4e60-a453-ee32fcaaac54', 'budget', 'progress', '수금 부스 운영 (8/31)', NULL, false, NULL, 21);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('c7416f8f-d98d-405a-b914-01fb948059f0', 'budget', 'progress', '물품 상태 지속 업데이트 (주문전/배송중/완료/브룸)', NULL, false, NULL, 22);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('63c8598a-d689-4019-82c5-c6c18b16e1ff', 'exchange', 'progress', '폼 마감 후 응답 수합', NULL, false, NULL, 0);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('017dc833-c651-4751-98cd-c4a33cef812b', 'exchange', 'progress', 'Departure Location별 분류', NULL, false, NULL, 1);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('6ff31d58-318d-4eee-bc0a-20e6c4f3d40f', 'exchange', 'progress', '버스 탑승자 명단 작성 (명륜 2대 분할 — 25-2 버스 80석 기준)', NULL, false, NULL, 2);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('b58bc9f3-2aae-4c8a-b77a-e8704cb1f2f0', 'exchange', 'progress', '식이제한별 집계 (도시락/비건·할랄/알러지 — 폼 13·14번)', NULL, false, NULL, 3);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('965735fe-77ff-4108-aa96-12aeeb5b37c4', 'exchange', 'progress', '티셔츠 사이즈별 집계 (S~3XL — 폼 9번)', NULL, false, NULL, 4);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('f716dda2-d0d5-4335-85bd-1a5d8b9f511d', 'exchange', 'progress', '성비 집계 (구글폼 16번 성별 항목 응답 활용 — §3-1 기본 포함)', NULL, false, NULL, 5);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('b57b4846-10e6-4bc1-b992-25131aa08431', 'exchange', 'progress', '지인 요청 매칭 정리 (폼 15번 "함께할 친구 이름")', NULL, false, NULL, 6);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('b0f741de-e9ab-4173-8cef-0f93234993c0', 'exchange', 'progress', '추가 접수 인원 별도 집계 (버스 좌석 한도 확인)', NULL, false, NULL, 7);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('613ce841-6d17-4481-9c22-bba4c9beb029', 'exchange', 'progress', '수금 완료 여부 체크', NULL, false, NULL, 8);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('8e6f0b6e-fe26-405f-aec0-8b5a3438438c', 'exchange', 'feedback', '구글폼 성별 항목 기본 포함', 'low', true, '26-1 피드백 반영, 결정 불필요 — §3-1', 9);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('143a2d0c-d950-48fd-950b-dfded2a5e11a', 'exchange', 'feedback', '입장 결제 확인 receipt 제공', 'medium', false, '26-1 교환 피드백: "결제 확인 안내 없음"', 10);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('515477d7-db7f-4bd5-94bc-02af0b3f427d', 'exchange', 'feedback', '율전/명륜 교환 도착 시간 차이 최소화 방안', 'medium', false, NULL, 11);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('e60c4e7c-7e8f-418e-9ef5-c7ffd5aa7acd', 'exchange', 'feedback', '입장 시 팀별 노래 + 팀장 깃발 아이디어', 'low', false, '26-1 피드백', 12);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('b8b6cf94-10c8-4e75-bed7-8bcf86fd5826', 'exchange', 'feedback', '추가 접수 시스템 사전 준비 (25-2 사례: 21명 추가 모집)', 'low', false, NULL, 13);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('c73063da-9b99-4d4a-9f4a-3f4f2146ba70', 'exchange', 'progress', '25-2 구글폼/안내문/추가접수 양식 확보 (주 템플릿)', NULL, false, NULL, 14);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('3a893f46-92ef-4b46-8f71-33cce84507f1', 'exchange', 'progress', '26-1 출석부·피드백 확보 (보조)', NULL, false, NULL, 15);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('62a66789-14d7-4116-833d-edbaeff224f0', 'exchange', 'progress', '구글폼 제작 (25-2 15문항 기준 + 성별 항목 16번 기본 포함)', NULL, false, NULL, 16);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('141408e8-c597-4619-9d96-ab441a7f2b89', 'exchange', 'progress', '구글폼 완성 (8/20)', NULL, false, NULL, 17);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('f37c19d3-f76d-4f3a-b4db-8ccc4aa41a9f', 'exchange', 'progress', '구글폼 배포', NULL, false, NULL, 18);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('bc2bf18f-e37c-48b3-9e94-246664171f92', 'exchange', 'progress', '접수 마감 (8/28)', NULL, false, NULL, 19);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('97c33846-3568-46ab-9902-99f4aec739be', 'exchange', 'progress', '추가 접수(Extra Registration) 필요성 판단 → 폼 개설', NULL, false, NULL, 20);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('1e00b89c-8728-4545-8e02-c3c7c1abdc17', 'exchange', 'progress', '응답 수합·명단 정리', NULL, false, NULL, 21);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('7eb07c1e-4ec3-4798-aa6e-071660eaf68b', 'exchange', 'progress', '버스 탑승 명단 작성 (명륜 2대 / Suwon 직행)', NULL, false, NULL, 22);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('9452af51-dc18-47f8-bf7a-4c16f6aa3779', 'exchange', 'progress', '교환 팀 배정 (9/3)', NULL, false, NULL, 23);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('fa9ab995-51f6-418f-9764-b9b4a1455a46', 'exchange', 'progress', '팀 편성 표 작성 (최종기획안)', NULL, false, NULL, 24);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('eddbd511-de62-4b04-aaa7-c26c561d1453', 'exchange', 'progress', '카드뉴스 인계물 제작 (25-2 17슬라이드 → 인사이드아웃 각색)', NULL, false, NULL, 25);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('40f95907-b1b2-43da-9a4d-3fe619c51d9f', 'exchange', 'progress', '홍보부 인계 (8/18, 8/30)', NULL, false, NULL, 26);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('10d31112-9a00-4ff8-a836-c3eb8f2480f0', 'exchange', 'progress', '카드뉴스 업로드 (8/27, 9/7)', NULL, false, NULL, 27);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('50fb78e5-6769-4c20-aa10-7586583ade2b', 'exchange', 'progress', '교환학생 정보방 개설 (9/4)', NULL, false, NULL, 28);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('4cb293c8-b8e2-4a0a-9198-5427d937ff84', 'timeline', 'progress', '명륜조 집합 장소 확정 (25-2: 국제관 L)', NULL, false, NULL, 0);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('341a9b9e-a592-4c8a-8d44-5cc34f1925aa', 'timeline', 'progress', '버스 탑승지 확정 (25-2: 600주년 기념관 앞)', NULL, false, NULL, 1);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('902c4cc4-9307-4159-b3cf-09f4a1b2a4d4', 'timeline', 'progress', '버스 탑승 명단 작성 (교환담당팀에서 전달)', NULL, false, NULL, 2);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('85b876e6-721c-43ec-bcad-a860a5a35747', 'timeline', 'progress', '버스 2대 분할 기준 (팀별? 캠퍼스별?)', NULL, false, NULL, 3);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('9d8d8b33-22b7-44c8-9041-53f35df2c8f6', 'timeline', 'progress', '상차 6 / 탑승안내 10 인력 배정 (오전)', NULL, false, NULL, 4);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('977a7592-4670-48f1-9168-9166835362b2', 'timeline', 'progress', '귀환 셔틀 위치 확정 (25-2: 수성관 5동 & 주차장 사이, N센터 앞)', NULL, false, NULL, 5);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('bc03aa7f-c0fb-4f36-b22b-c326e87c729a', 'timeline', 'progress', '오후 상차 3 / 탑승안내 4 인력 배정', NULL, false, NULL, 6);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('fbae130d-4016-44c2-8f72-80ecdb74bc11', 'timeline', 'progress', '버스 대기 중 프로그램 검토 (도착 시간차 이슈)', NULL, false, NULL, 7);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('07f66d1b-a61f-4640-8482-2307ba2582f3', 'timeline', 'progress', '율전 도착 후 인솔 동선 (입장관리존까지)', NULL, false, NULL, 8);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('d6176869-d975-455f-b3a8-7b86971160c6', 'timeline', 'feedback', '사회자는 영어 편한 사람 배정 (26-1 호평, 25-2에도 적용)', 'medium', false, NULL, 9);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('41052cc7-bddb-4112-b6ae-652c8456ac23', 'timeline', 'feedback', '심판 역할 배정은 최소 3일 전 (작년: 전날 배정으로 숙지 부족)', 'medium', false, NULL, 10);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('5c03e10c-5c77-405f-9355-0e718cbb1603', 'timeline', 'feedback', '명륜조/율전조 도착 시간 차이 최소화 (율전조 선행 세팅으로 해결)', 'medium', false, NULL, 11);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('16fb1ade-296b-47ed-83ca-dd25f9c70c8c', 'timeline', 'feedback', '입장 시 팀별 노래 + 팀장 깃발 (팀워크)', 'low', false, NULL, 12);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('09753407-4f57-4d9e-b446-63a6cd33862d', 'timeline', 'feedback', '점수 집계 노트북 필수 (25-2)', 'low', false, NULL, 13);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('222f895b-5f10-4cc6-bdcd-41c8b11f2ae8', 'timeline', 'feedback', '개회 K-pop BGM 팀별 입장 (25-2)', 'low', false, NULL, 14);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('69d99fc1-8db6-45e9-806e-bc93b705dbed', 'timeline', 'feedback', '국민체조 시범 편성 (25-2, 13:00~13:30)', 'low', false, NULL, 15);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('ea499b92-b929-4bca-9ff8-3d473454f5eb', 'timeline', 'feedback', '귀환 셔틀 18:30 고정 (25-2: 수성관 5동 & 주차장 사이, N센터 앞)', 'low', false, NULL, 16);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('9f201b9c-46f0-407c-a5c7-a150fe470c84', 'timeline', 'progress', '하클 가용인원 조사 (8/17)', NULL, false, NULL, 17);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('771fe712-ab46-40b3-942e-33ca571504c8', 'timeline', 'progress', '컨텐츠팀 게임 소요시간 수령 (8/16 이후) → 1부/2부 시간 미세조정', NULL, false, NULL, 18);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('5f75fe73-df32-4859-8891-dde88649218d', 'timeline', 'progress', '교환 팀 배정 결과 수령 (9/3) → 팀장 6명 확정', NULL, false, NULL, 19);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('4712bc8b-ee4e-4b18-b337-d10acbc2a388', 'timeline', 'progress', '전체 타임라인 완성 (8/13, 25-2 베이스 차용)', NULL, false, NULL, 20);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('ec7617cb-3690-4a2f-905f-49c6d4078754', 'timeline', 'progress', '하클 역할 배치표 작성 (48명, 버스 23명 별도 풀)', NULL, false, NULL, 21);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('f5c6e9fa-e63a-4134-b708-bb0fa39345b9', 'timeline', 'progress', '심판 배정표 (최소 3일 전)', NULL, false, NULL, 22);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('f562615b-5b35-49fa-bc7a-ecff1624408c', 'timeline', 'progress', '명륜→율전 버스 운영 계획서 (이중 집합 + 귀환 셔틀 포함)', NULL, false, NULL, 23);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('d991a897-49e2-48d4-96fb-65b06739ba1a', 'timeline', 'progress', '버스 인력 23명 배정 (오전 16 / 오후 7)', NULL, false, NULL, 24);
INSERT INTO public.checklist_items (id, team_id, section, content, priority, completed, source, sort_order) VALUES ('be460d84-b20a-4e57-af4c-ae9978f90c92', 'timeline', 'progress', '행사 당일 타임라인 시트 작성 (최종기획안)', NULL, false, NULL, 25);

-- ===== issues =====
DELETE FROM public.issues;

COMMIT;
-- ═══════════ 0007_drive_integration.sql ═══════════
-- 구글 드라이브 연동: 토큰 + 파일 캐시 + audit team_id

-- ===== drive_tokens (싱글톤, 관리자 OAuth 토큰) =====
create table if not exists public.drive_tokens (
  id            int primary key default 1 check (id = 1),
  email         text,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS: 클라이언트 읽기 차단, 쓰기 허용 (서버는 service_role로 우회)
alter table public.drive_tokens enable row level security;
create policy "tokens_no_read"  on public.drive_tokens for select using (false);
create policy "tokens_write"    on public.drive_tokens for insert with check (true);
create policy "tokens_update"   on public.drive_tokens for update using (true);
create policy "tokens_delete"   on public.drive_tokens for delete using (true);

-- updated_at 트리거
create trigger trg_drive_tokens_updated
  before update on public.drive_tokens
  for each row execute function public.touch_updated_at();

-- ===== drive_files (파일 메타데이터 캐시) =====
create table if not exists public.drive_files (
  id            uuid primary key default gen_random_uuid(),
  team_id       text not null references public.teams(id) on delete cascade,
  file_id       text not null unique,
  name          text not null,
  mime_type     text,
  icon_link     text,
  modified_time timestamptz,
  modified_by   text,
  web_view_link text,
  last_synced   timestamptz not null default now()
);

create index if not exists idx_drive_files_team on public.drive_files(team_id);
create index if not exists idx_drive_files_modified on public.drive_files(modified_time desc);

alter table public.drive_files enable row level security;
create policy "drive_files_open_read"  on public.drive_files for select using (true);
create policy "drive_files_open_write" on public.drive_files for insert with check (true);
create policy "drive_files_open_edit"  on public.drive_files for update using (true);
create policy "drive_files_open_del"   on public.drive_files for delete using (true);

-- ===== teams에 drive_folder_id 컬럼 추가 =====
alter table public.teams add column if not exists drive_folder_id text;

-- ===== audit_log에 team_id 컬럼 추가 (활동 피드용) =====
alter table public.audit_log add column if not exists team_id text;

create index if not exists idx_audit_log_team on public.audit_log(team_id);

-- ═══════════ 0008_checklist_milestone_integration.sql ═══════════
-- 0008: 체크리스트·타임라인 통합
-- checklist_items.section 제거, milestone_id FK 추가

BEGIN;

-- ===== 스키마 변경 =====
-- milestone_id FK 추가 (nullable: NULL = 상시 버킷)
alter table public.checklist_items
  add column if not exists milestone_id uuid
  references public.milestones(id) on delete set null;

-- 인덱스 (마일스톤별 조회 빈도 high)
create index if not exists idx_checklist_items_milestone_id
  on public.checklist_items (milestone_id);

-- section 컬럼 제거
alter table public.checklist_items drop column if exists section;

-- ===== 시드 재매핑: 각 체크리스트 항목에 milestone_id 설정 =====
-- 마일스톤 UUID는 0005_seed_data.sql 참조

-- --- content 팀 ---
-- feedback (전부 상시)
update public.checklist_items set milestone_id = null
  where id in (
    '754128ed-df14-4aee-8892-d0a04caf1e18',  -- 심판 규칙 사전 숙지
    '53d79cbd-b38c-45ad-9e13-8b4e3a79b8f6',  -- 토너먼트 균형 배분
    'e24c5cbc-eabc-4877-9355-30269db00188',  -- 미니게임 유도
    'c6bff0cd-4d76-4f05-92d8-10f41baaef35',  -- 규칙 설명 더 명확히
    '536b76df-6b20-453e-82d2-ed8523258a31',  -- 토너먼트 무궁화 채택 시
    'e821087a-90c3-4979-8ee1-6314234d4e2a'   -- 페이스페인팅 유지
  );

-- progress → 마일스톤 매핑
update public.checklist_items set milestone_id = '05e80dca-3781-4386-b44a-65e590be03d0'  -- 8/9 기획팀 2차 회의
  where id = '939f0e15-b48b-4ca6-bdc5-b38428319f56';  -- 컨셉(D1)·팀 개수(D2) 수령

update public.checklist_items set milestone_id = '574abb84-6290-49c0-ac64-2f346354473b'  -- 8/16 컨텐츠 완성
  where id in (
    'f6429af2-863e-4166-a732-8f80a95548d1',  -- 토너먼트 4종 확정
    '1630a01e-a68d-4cec-a1cb-211c190aff0b',  -- 메인게임 2종 확정
    '56a4eab9-550e-4f40-9c1e-dab34fc8c815',  -- 미니게임 6종 확정
    'ddbb10aa-7bab-446d-b6ea-ff247efee7dd',  -- 각 게임별 상세 시트 작성
    '21f56dac-d5d3-4ef5-a3b7-18dacc9eb307',  -- 점수배분 체계 확정
    '728a5f1a-3033-48b4-8e3b-7f7ec74f16b1',  -- 필요 물품 리스트 → 예산팀 인계
    '35821fe8-64df-47c8-b17e-442e918ae15f'   -- 율전 대운동장 배치도 작성
  );

update public.checklist_items set milestone_id = '80d4d35c-9b1d-4bd5-ac8c-ba80e2af016a'  -- 9/18 최종 브리핑 (심판 배정 3일 전)
  where id = '1a286c8b-1485-4e0f-8330-514f0a6ba064';  -- 심판 배정표 (최소 3일 전)

update public.checklist_items set milestone_id = '6461433b-f463-4082-b909-fd721f929731'  -- 8/30 컨텐츠 안내 홍보부 인계
  where id = '8cc9ec56-98d1-4de3-8a94-d80d3b054e54';  -- 컨텐츠 안내 → 교환담당팀 인계

-- --- budget 팀 ---
-- feedback (전부 상시)
update public.checklist_items set milestone_id = null
  where id in (
    '1e24a590-3830-4336-a008-7294ea272bc3',  -- 율전 브룸에 물품 미리 비치
    '2b46ba62-60ca-4eb5-81b1-51c8b54cc13e',  -- 점심 호불호 적은 메뉴 검토
    '087b9546-52c4-44c7-8cc4-bfc0c16856b2',  -- 음식물 쓰레기통 별도 비치
    '57321bec-7814-4cde-9689-2c019d9d7103',  -- 비건 음식 지연 주의
    '91828980-44ed-4b47-b61a-0c85a6365ef3',  -- 중간 간식 제공 검토
    '70b5742e-b07e-45c0-969f-c5876a15feec',  -- 물총 교환학생 자유 사용 허용 검토
    '961f82c9-1fbf-4219-87ae-79096b009ebd'   -- SG MAPLE 챙기기
  );

-- progress
update public.checklist_items set milestone_id = '05e80dca-3781-4386-b44a-65e590be03d0'  -- 8/9 기획팀 2차 회의
  where id in (
    'e06dc6cf-b0d7-4bc0-b357-7232e1bd84f6',  -- 8/9 회의: 주문처 리드타임 확인
    '92ce63d1-cfab-47f9-82b1-b72749864bf2',  -- 단체티 방침 + 리드타임 확인
    'cf501751-29c6-498f-b584-2a51e61de9c9',  -- 점심 메뉴 방향 논의
    '25897d0b-3a6b-4948-960e-ac6414b6203f',  -- 신규 제작 전제
    '1bbdb684-4faa-4257-8648-2aea30eb1986'   -- 시안(컨셉 연동)
  );

update public.checklist_items set milestone_id = '574abb84-6290-49c0-ac64-2f346354473b'  -- 8/16 컨텐츠 완성 (게임 물품 리스트 수령)
  where id = '37456e61-5177-4011-8a20-4689b050df54';  -- 게임 물품 리스트 수령

update public.checklist_items set milestone_id = '313c6967-1b39-4ae2-9170-efbec25a491d'  -- 8/25 최종기획안 완성
  where id in (
    '12ddc088-5491-4729-941f-180bfa96a336',  -- 입장료 결정 (8/16~8/25)
    '414bb4aa-2fbc-4c4e-b9e1-179c45557e20',  -- 예산안 작성
    '1dcde297-f2e3-4abc-8f7a-7a6b1e4b0ccc'   -- 단체티 시안
  );

update public.checklist_items set milestone_id = '5bad5e6b-20a2-4554-a862-27c549231c5f'  -- 8/28 구글폼 접수 마감 (참여 인원 확정)
  where id = '8772d8fb-4cdf-4083-a06a-83c010de8b84';  -- 참여 인원 확정 후 식사 수량 조정

update public.checklist_items set milestone_id = '8130cc5d-88c6-42d3-bcdc-329ec47824cf'  -- 9/3 교환 팀 배정 완료
  where id = '21fcb85c-fc51-4e6f-a975-d3d8b3a71a7d';  -- 팀 배정 후 단체티 수량 확정

update public.checklist_items set milestone_id = '8130cc5d-88c6-42d3-bcdc-329ec47824cf'  -- 9/3 교환 팀 배정 완료
  where id = '70bd13fd-75ce-4757-bca0-7c8e39723920';  -- 수량(팀 배정 9/3 후) + 주문처(탑앤탑)

update public.checklist_items set milestone_id = 'ee855044-a221-49c0-bb97-5027db3ae01b'  -- 9/3 준비물 주문
  where id = '82117660-2793-437f-84a8-ad7964f4c593';  -- 준비물 주문 (9/3)

update public.checklist_items set milestone_id = '5417292e-5850-4ea8-940c-acc99f2c088b'  -- 9/4 단체티 주문
  where id = '2a64be7d-38b2-4200-a20a-b816ec4b42a2';  -- 단체티 주문 (9/4)

update public.checklist_items set milestone_id = '0e960487-b65d-4fe0-a876-c58a6799cb69'  -- 8/31 수금 부스
  where id = 'b583f3d6-77ff-4e60-a453-ee32fcaaac54';  -- 수금 부스 운영 (8/31)

update public.checklist_items set milestone_id = null  -- 상시
  where id = 'c7416f8f-d98d-405a-b914-01fb948059f0';  -- 물품 상태 지속 업데이트

-- --- exchange 팀 ---
-- feedback (전부 상시)
update public.checklist_items set milestone_id = null
  where id in (
    '143a2d0c-d950-48fd-950b-dfded2a5e11a',  -- 입장 결제 확인 receipt 제공
    '515477d7-db7f-4bd5-94bc-02af0b3f427d',  -- 율전/명륜 도착 시간차 최소화
    'e60c4e7c-7e8f-418e-9ef5-c7ffd5aa7acd',  -- 입장 시 팀별 노래 + 깃발
    'b8b6cf94-10c8-4e75-bed7-8bcf86fd5826'   -- 추가 접수 시스템 사전 준비
  );

update public.checklist_items set milestone_id = '6461433b-f463-4082-b909-fd721f929731'  -- 8/30 컨텐츠 안내 홍보부 인계 (성별 항목은 컨텐츠와 연관)
  where id = '8e6f0b6e-fe26-405f-aec0-8b5a3438438c';  -- 구글폼 성별 항목 기본 포함 (completed=true)

-- progress
update public.checklist_items set milestone_id = 'b3b447fa-fa83-4d90-85c0-3ad5cd619466'  -- 8/20 구글폼 완성
  where id in (
    'c73063da-9b99-4d4a-9f4a-3f4f2146ba70',  -- 25-2 구글폼/안내문 양식 확보
    '3a893f46-92ef-4b46-8f71-33cce84507f1',  -- 26-1 출석부·피드백 확보
    '62a66789-14d7-4116-833d-edbaeff224f0',  -- 구글폼 제작
    '141408e8-c597-4619-9d96-ab441a7f2b89'   -- 구글폼 완성 (8/20)
  );

update public.checklist_items set milestone_id = null  -- 상시 (구글폼 배포는 완성 직후, 명확한 마일스톤 없음)
  where id = 'f37c19d3-f76d-4f3a-b4db-8ccc4aa41a9f';  -- 구글폼 배포

update public.checklist_items set milestone_id = '5bad5e6b-20a2-4554-a862-27c549231c5f'  -- 8/28 구글폼 접수 마감
  where id in (
    'bc2bf18f-e37c-48b3-9e94-246664171f92',  -- 접수 마감 (8/28)
    '63c8598a-d689-4019-82c5-c6c18b16e1ff',  -- 폼 마감 후 응답 수합
    '017dc833-c651-4751-98cd-c4a33cef812b',  -- Departure Location별 분류
    'b58bc9f3-2aae-4c8a-b77a-e8704cb1f2f0',  -- 식이제한별 집계
    '965735fe-77ff-4108-aa96-12aeeb5b37c4',  -- 티셔츠 사이즈별 집계
    'f716dda2-d0d5-4335-85bd-1a5d8b9f511d',  -- 성비 집계
    'b57b4846-10e6-4bc1-b992-25131aa08431',  -- 지인 요청 매칭 정리
    'b0f741de-e9ab-4173-8cef-0f93234993c0',  -- 추가 접수 인원 별도 집계
    '613ce841-6d17-4481-9c22-bba4c9beb029',  -- 수금 완료 여부 체크
    '97c33846-3568-46ab-9902-99f4aec739be',  -- 추가 접수 필요성 판단 → 폼 개설
    '1e00b89c-8728-4545-8e02-c3c7c1abdc17'   -- 응답 수합·명단 정리
  );

update public.checklist_items set milestone_id = '8130cc5d-88c6-42d3-bcdc-329ec47824cf'  -- 9/3 교환 팀 배정 완료
  where id in (
    '9452af51-dc18-47f8-bf7a-4c16f6aa3779',  -- 교환 팀 배정 (9/3)
    'fa9ab995-51f6-418f-9764-b9b4a1455a46',  -- 팀 편성 표 작성
    '6ff31d58-318d-4eee-bc0a-20e6c4f3d40f',  -- 버스 탑승자 명단 작성 (명륜 분할)
    '7eb07c1e-4ec3-4798-aa6e-071660eaf68b'   -- 버스 탑승 명단 작성 (명륜 2대 / Suwon)
  );

update public.checklist_items set milestone_id = '3f459a38-0242-41c3-adbf-eee8f8562fb4'  -- 8/18 카드뉴스 홍보부 인계
  where id = 'eddbd511-de62-4b04-aaa7-c26c561d1453';  -- 카드뉴스 인계물 제작

update public.checklist_items set milestone_id = 'f63fbaa4-cb7b-4e87-aabc-4f8217c1cd19'  -- 8/27 카드뉴스 업로드
  where id = '40f95907-b1b2-43da-9a4d-3fe619c51d9f';  -- 홍보부 인계 (8/18, 8/30) — 8/18 인계 기준

update public.checklist_items set milestone_id = 'f63fbaa4-cb7b-4e87-aabc-4f8217c1cd19'  -- 8/27 카드뉴스 업로드
  where id = '10d31112-9a00-4ff8-a836-c3eb8f2480f0';  -- 카드뉴스 업로드 (8/27, 9/7)

update public.checklist_items set milestone_id = '7ef8ed20-b0e8-4109-83df-f76589def7cb'  -- 9/4 교환학생 정보방 개설
  where id = '50fb78e5-6769-4c20-aa10-7586583ade2b';  -- 교환학생 정보방 개설 (9/4)

-- --- timeline 팀 ---
-- feedback (전부 상시)
update public.checklist_items set milestone_id = null
  where id in (
    'd6176869-d975-455f-b3a8-7b86971160c6',  -- 사회자 영어 편한 사람 배정
    '41052cc7-bddb-4112-b6ae-652c8456ac23',  -- 심판 역할 배정 3일 전
    '5c03e10c-5c77-405f-9355-0e718cbb1603',  -- 명륜조/율전조 도착 시간차 최소화
    '16fb1ade-296b-47ed-83ca-dd25f9c70c8c',  -- 입장 시 팀별 노래 + 깃발
    '09753407-4f57-4d9e-b446-63a6cd33862d',  -- 점수 집계 노트북 필수
    '222f895b-5f10-4cc6-bdcd-41c8b11f2ae8',  -- 개회 K-pop BGM
    '69d99fc1-8db6-45e9-806e-bc93b705dbed',  -- 국민체조 시범 편성
    'ea499b92-b929-4bca-9ff8-3d473454f5eb'   -- 귀환 셔틀 18:30 고정
  );

-- progress
update public.checklist_items set milestone_id = '8b316af3-9b1e-424c-87ed-93ba60d9abf9'  -- 8/13 타임라인 완성
  where id in (
    '4712bc8b-ee4e-4b18-b337-d10acbc2a388',  -- 전체 타임라인 완성 (8/13)
    '4cb293c8-b8e2-4a0a-9198-5427d937ff84',  -- 명륜조 집합 장소 확정
    '341a9b9e-a592-4c8a-8d44-5cc34f1925aa',  -- 버스 탑승지 확정
    '85b876e6-721c-43ec-bcad-a860a5a35747',  -- 버스 2대 분할 기준
    '977a7592-4670-48f1-9168-9166835362b2'   -- 귀환 셔틀 위치 확정
  );

update public.checklist_items set milestone_id = '574abb84-6290-49c0-ac64-2f346354473b'  -- 8/16 컨텐츠 완성 (게임 소요시간 수령)
  where id = '771fe712-ab46-40b3-942e-33ca571504c8';  -- 컨텐츠팀 게임 소요시간 수령 (8/16 이후)

update public.checklist_items set milestone_id = 'd98d89c3-50e8-4d85-a765-bd327d284199'  -- 8/17 하클 가용인원 조사
  where id = '9f201b9c-46f0-407c-a5c7-a150fe470c84';  -- 하클 가용인원 조사 (8/17)

update public.checklist_items set milestone_id = '8130cc5d-88c6-42d3-bcdc-329ec47824cf'  -- 9/3 교환 팀 배정 완료 (팀장 6명 확정, 하클 배치)
  where id in (
    '5f75fe73-df32-4859-8891-dde88649218d',  -- 교환 팀 배정 결과 수령 → 팀장 6명 확정
    '902c4cc4-9307-4159-b3cf-09f4a1b2a4d4',  -- 버스 탑승 명단 작성 (교환에서 전달)
    'ec7617cb-3690-4a2f-905f-49c6d4078754',  -- 하클 역할 배치표 작성
    'f5c6e9fa-e63a-4134-b708-bb0fa39345b9',  -- 심판 배정표 (최소 3일 전)
    '9d8d8b33-22b7-44c8-9041-53f35df2c8f6',  -- 상차 6/탑승안내 10 인력 배정 (오전)
    'bc03aa7f-c0fb-4f36-b22b-c326e87c729a',  -- 오후 상차 3/탑승안내 4 인력 배정
    'd991a897-49e2-48d4-96fb-65b06739ba1a'   -- 버스 인력 23명 배정 (오전 16/오후 7)
  );

update public.checklist_items set milestone_id = '8b316af3-9b1e-424c-87ed-93ba60d9abf9'  -- 8/13 타임라인 완성 (버스 운영 계획서는 타임라인 산출물)
  where id = 'f562615b-5b35-49fa-bc7a-ecff1624408c';  -- 명륜→율전 버스 운영 계획서 (이중 집합 + 귀환 셔틀 포함)

update public.checklist_items set milestone_id = '6c0a214f-9e96-48d0-8f07-6c969bb19ca8'  -- 9/19 Sports Day
  where id in (
    'fbae130d-4016-44c2-8f72-80ecdb74bc11',  -- 버스 대기 중 프로그램 검토
    '07f66d1b-a61f-4640-8482-2307ba2582f3',  -- 율전 도착 후 인솔 동선
    'be460d84-b20a-4e57-af4c-ae9978f90c92'   -- 행사 당일 타임라인 시트 작성
  );

COMMIT;

-- ═══════════ 0009_refine_checklist_content.sql ═══════════
-- 0009: 체크리스트 항목 텍스트 다듬기
-- 94개 항목의 content와 source를 일괄 UPDATE
-- 원본은 0005_seed_data.sql에 보존됨 (되돌리기 가능)
-- 변경 내역: D번호 기호 제거, §절 참조 풀기, 작년 참고 source 분리, 날짜 중복 제거

BEGIN;

UPDATE public.checklist_items SET content = '심판 규칙 사전 숙지: 각 게임 규칙 문서화 → 최소 3일 전 심판 배정 → 오프라인 사전 리허설', source = NULL WHERE id = '754128ed-df14-4aee-8892-d0a04caf1e18';
UPDATE public.checklist_items SET content = '토너먼트 균형 배분: 1·2부에 줄다리기/피구/계주가 몰리지 않도록 분산', source = NULL WHERE id = '53d79cbd-b38c-45ad-9e13-8b4e3a79b8f6';
UPDATE public.checklist_items SET content = '미니게임 유도: 2부 미니게임 참여 유도 방안 (작년 한산)', source = NULL WHERE id = 'e24c5cbc-eabc-4877-9355-30269db00188';
UPDATE public.checklist_items SET content = '규칙 설명 더 명확히 + 반칙 시 패널티 규정 포함', source = NULL WHERE id = 'c6bff0cd-4d76-4f05-92d8-10f41baaef35';
UPDATE public.checklist_items SET content = '토너먼트 2번째로 무궁화(26-1) 채택 시: 탈락자 선정에 물총 대신 뿅망치 (조준 애매)', source = NULL WHERE id = '536b76df-6b20-453e-82d2-ed8523258a31';
UPDATE public.checklist_items SET content = '페이스페인팅 유지', source = NULL WHERE id = 'e821087a-90c3-4979-8ee1-6314234d4e2a';
UPDATE public.checklist_items SET content = '컨셉·팀 개수 수령', source = NULL WHERE id = '939f0e15-b48b-4ca6-bdc5-b38428319f56';
UPDATE public.checklist_items SET content = '토너먼트 4종 확정', source = NULL WHERE id = 'f6429af2-863e-4166-a732-8f80a95548d1';
UPDATE public.checklist_items SET content = '메인게임 2종 확정', source = NULL WHERE id = '1630a01e-a68d-4cec-a1cb-211c190aff0b';
UPDATE public.checklist_items SET content = '미니게임 6종 확정', source = NULL WHERE id = '56a4eab9-550e-4f40-9c1e-dab34fc8c815';
UPDATE public.checklist_items SET content = '각 게임별 상세 시트 작성 (양식 지침의 게임 양식)', source = NULL WHERE id = 'ddbb10aa-7bab-446d-b6ea-ff247efee7dd';
UPDATE public.checklist_items SET content = '점수배분 체계 확정', source = NULL WHERE id = '21f56dac-d5d3-4ef5-a3b7-18dacc9eb307';
UPDATE public.checklist_items SET content = '필요 물품 리스트 → 예산팀 인계', source = NULL WHERE id = '728a5f1a-3033-48b4-8e3b-7f7ec74f16b1';
UPDATE public.checklist_items SET content = '율전 대운동장 배치도 작성', source = NULL WHERE id = '35821fe8-64df-47c8-b17e-442e918ae15f';
UPDATE public.checklist_items SET content = '심판 배정표 (최소 3일 전)', source = NULL WHERE id = '1a286c8b-1485-4e0f-8330-514f0a6ba064';
UPDATE public.checklist_items SET content = '컨텐츠 안내 → 교환담당팀(카드뉴스) 인계', source = NULL WHERE id = '8cc9ec56-98d1-4de3-8a94-d80d3b054e54';
UPDATE public.checklist_items SET content = '8/9 회의에서 확인: 주문처(탑앤탑) 리드타임', source = NULL WHERE id = 'e06dc6cf-b0d7-4bc0-b357-7232e1bd84f6';
UPDATE public.checklist_items SET content = '신규 제작 전제 (인사이드아웃 도안)', source = NULL WHERE id = '25897d0b-3a6b-4948-960e-ac6414b6203f';
UPDATE public.checklist_items SET content = '시안(컨셉 연동)', source = NULL WHERE id = '1bbdb684-4faa-4257-8648-2aea30eb1986';
UPDATE public.checklist_items SET content = '수량(팀 배정 9/3 후) + 주문처(탑앤탑, 단가 12,400원)', source = NULL WHERE id = '70bd13fd-75ce-4757-bca0-7c8e39723920';
UPDATE public.checklist_items SET content = '율전 브룸에 물품 미리 비치', source = '이번 26-2는 율전 / 26-1: 명륜 브룸 부재로 당일 혼란' WHERE id = '1e24a590-3830-4336-a008-7294ea272bc3';
UPDATE public.checklist_items SET content = '점심 호불호 적은 메뉴 검토 → 25-2 불고기버거(롯데리아) 방식 채택', source = '26-1 돈까스도시락 호불호 피드백' WHERE id = '2b46ba62-60ca-4eb5-81b1-51c8b54cc13e';
UPDATE public.checklist_items SET content = '음식물 쓰레기통 별도 비치 + 사전 안내 (작년 분리수거 혼란)', source = NULL WHERE id = '087b9546-52c4-44c7-8cc4-bfc0c16856b2';
UPDATE public.checklist_items SET content = '비건 음식 지연 주의 (시간 여유)', source = NULL WHERE id = '57321bec-7814-4cde-9689-2c019d9d7103';
UPDATE public.checklist_items SET content = '중간 간식(에너지바, 핫바) 제공 검토', source = NULL WHERE id = '91828980-44ed-4b47-b61a-0c85a6365ef3';
UPDATE public.checklist_items SET content = '물총 교환학생 자유 사용 허용 검토', source = NULL WHERE id = '70b5742e-b07e-45c0-969f-c5876a15feec';
UPDATE public.checklist_items SET content = 'SG MAPLE(정규 교환) 챙기기', source = NULL WHERE id = '961f82c9-1fbf-4219-87ae-79096b009ebd';
UPDATE public.checklist_items SET content = '단체티 방침(신규 전제) + 주문처 리드타임 확인 (8/9 회의)', source = NULL WHERE id = '92ce63d1-cfab-47f9-82b1-b72749864bf2';
UPDATE public.checklist_items SET content = '점심 메뉴 방향 논의 (8/9 회의)', source = NULL WHERE id = 'cf501751-29c6-498f-b584-2a51e61de9c9';
UPDATE public.checklist_items SET content = '입장료 결정 (8/16~8/25 — 동아리 예산 보전 한도 파악 후)', source = NULL WHERE id = '12ddc088-5491-4729-941f-180bfa96a336';
UPDATE public.checklist_items SET content = '게임 물품 리스트 수령 (컨텐츠팀 8/16 완성 후)', source = NULL WHERE id = '37456e61-5177-4011-8a20-4689b050df54';
UPDATE public.checklist_items SET content = '예산안 작성(단가·수량·총액)', source = NULL WHERE id = '414bb4aa-2fbc-4c4e-b9e1-179c45557e20';
UPDATE public.checklist_items SET content = '단체티 시안 (리드타임에 따라 8/16 이후 또는 즉시 착수)', source = NULL WHERE id = '1dcde297-f2e3-4abc-8f7a-7a6b1e4b0ccc';
UPDATE public.checklist_items SET content = '참여 인원 확정 후 식사 수량 조정 (8/28 이후)', source = NULL WHERE id = '8772d8fb-4cdf-4083-a06a-83c010de8b84';
UPDATE public.checklist_items SET content = '팀 배정 후 단체티 수량 확정 (9/3 이후)', source = NULL WHERE id = '21fcb85c-fc51-4e6f-a975-d3d8b3a71a7d';
UPDATE public.checklist_items SET content = '준비물 주문', source = NULL WHERE id = '82117660-2793-437f-84a8-ad7964f4c593';
UPDATE public.checklist_items SET content = '단체티 주문', source = NULL WHERE id = '2a64be7d-38b2-4200-a20a-b816ec4b42a2';
UPDATE public.checklist_items SET content = '수금 부스 운영', source = NULL WHERE id = 'b583f3d6-77ff-4e60-a453-ee32fcaaac54';
UPDATE public.checklist_items SET content = '물품 상태 지속 업데이트 (주문전/배송중/완료/브룸)', source = NULL WHERE id = 'c7416f8f-d98d-405a-b914-01fb948059f0';
UPDATE public.checklist_items SET content = '폼 마감 후 응답 수합', source = NULL WHERE id = '63c8598a-d689-4019-82c5-c6c18b16e1ff';
UPDATE public.checklist_items SET content = 'Departure Location별 분류', source = NULL WHERE id = '017dc833-c651-4751-98cd-c4a33cef812b';
UPDATE public.checklist_items SET content = '버스 탑승자 명단 작성 (명륜 2대 분할 — 25-2 버스 80석 기준)', source = NULL WHERE id = '6ff31d58-318d-4eee-bc0a-20e6c4f3d40f';
UPDATE public.checklist_items SET content = '식이제한별 집계 (도시락/비건·할랄/알러지 — 폼 13·14번)', source = NULL WHERE id = 'b58bc9f3-2aae-4c8a-b77a-e8704cb1f2f0';
UPDATE public.checklist_items SET content = '티셔츠 사이즈별 집계 (S~3XL — 폼 9번)', source = NULL WHERE id = '965735fe-77ff-4108-aa96-12aeeb5b37c4';
UPDATE public.checklist_items SET content = '성비 집계 (구글폼 16번 성별 항목 응답 활용 — 지침의 성별 항목 안내 기본 포함)', source = NULL WHERE id = 'f716dda2-d0d5-4335-85bd-1a5d8b9f511d';
UPDATE public.checklist_items SET content = '지인 요청 매칭 정리 (폼 15번 "함께할 친구 이름")', source = NULL WHERE id = 'b57b4846-10e6-4bc1-b992-25131aa08431';
UPDATE public.checklist_items SET content = '추가 접수 인원 별도 집계 (버스 좌석 한도 확인)', source = NULL WHERE id = 'b0f741de-e9ab-4173-8cef-0f93234993c0';
UPDATE public.checklist_items SET content = '수금 완료 여부 체크', source = NULL WHERE id = '613ce841-6d17-4481-9c22-bba4c9beb029';
UPDATE public.checklist_items SET content = '구글폼 성별 항목 기본 포함', source = '26-1 피드백 반영, 결정 불필요 — §3-1' WHERE id = '8e6f0b6e-fe26-405f-aec0-8b5a3438438c';
UPDATE public.checklist_items SET content = '입장 결제 확인 receipt 제공', source = '26-1 교환 피드백: "결제 확인 안내 없음"' WHERE id = '143a2d0c-d950-48fd-950b-dfded2a5e11a';
UPDATE public.checklist_items SET content = '율전/명륜 교환 도착 시간 차이 최소화 방안', source = NULL WHERE id = '515477d7-db7f-4bd5-94bc-02af0b3f427d';
UPDATE public.checklist_items SET content = '입장 시 팀별 노래 + 팀장 깃발 아이디어', source = '26-1 피드백' WHERE id = 'e60c4e7c-7e8f-418e-9ef5-c7ffd5aa7acd';
UPDATE public.checklist_items SET content = '추가 접수 시스템 사전 준비 (25-2 사례: 21명 추가 모집)', source = NULL WHERE id = 'b8b6cf94-10c8-4e75-bed7-8bcf86fd5826';
UPDATE public.checklist_items SET content = '25-2 구글폼/안내문/추가접수 양식 확보 (주 기준(25-2))', source = NULL WHERE id = 'c73063da-9b99-4d4a-9f4a-3f4f2146ba70';
UPDATE public.checklist_items SET content = '26-1 출석부·피드백 확보 (보조)', source = NULL WHERE id = '3a893f46-92ef-4b46-8f71-33cce84507f1';
UPDATE public.checklist_items SET content = '구글폼 제작 (25-2 15문항 기준 + 성별 항목 16번 기본 포함)', source = NULL WHERE id = '62a66789-14d7-4116-833d-edbaeff224f0';
UPDATE public.checklist_items SET content = '구글폼 완성', source = NULL WHERE id = '141408e8-c597-4619-9d96-ab441a7f2b89';
UPDATE public.checklist_items SET content = '구글폼 배포', source = NULL WHERE id = 'f37c19d3-f76d-4f3a-b4db-8ccc4aa41a9f';
UPDATE public.checklist_items SET content = '접수 마감', source = NULL WHERE id = 'bc2bf18f-e37c-48b3-9e94-246664171f92';
UPDATE public.checklist_items SET content = '추가 접수(Extra Registration) 필요성 판단 → 폼 개설', source = NULL WHERE id = '97c33846-3568-46ab-9902-99f4aec739be';
UPDATE public.checklist_items SET content = '응답 수합·명단 정리', source = NULL WHERE id = '1e00b89c-8728-4545-8e02-c3c7c1abdc17';
UPDATE public.checklist_items SET content = '버스 탑승 명단 작성 (명륜 2대 / Suwon 직행)', source = NULL WHERE id = '7eb07c1e-4ec3-4798-aa6e-071660eaf68b';
UPDATE public.checklist_items SET content = '교환 팀 배정', source = NULL WHERE id = '9452af51-dc18-47f8-bf7a-4c16f6aa3779';
UPDATE public.checklist_items SET content = '팀 편성 표 작성 (최종기획안)', source = NULL WHERE id = 'fa9ab995-51f6-418f-9764-b9b4a1455a46';
UPDATE public.checklist_items SET content = '카드뉴스 인계물 제작 (25-2 17슬라이드 → 인사이드아웃 각색)', source = NULL WHERE id = 'eddbd511-de62-4b04-aaa7-c26c561d1453';
UPDATE public.checklist_items SET content = '홍보부 인계', source = NULL WHERE id = '40f95907-b1b2-43da-9a4d-3fe619c51d9f';
UPDATE public.checklist_items SET content = '카드뉴스 업로드', source = NULL WHERE id = '10d31112-9a00-4ff8-a836-c3eb8f2480f0';
UPDATE public.checklist_items SET content = '교환학생 정보방 개설', source = NULL WHERE id = '50fb78e5-6769-4c20-aa10-7586583ade2b';
UPDATE public.checklist_items SET content = '명륜조 집합 장소 확정', source = '25-2: 국제관 L' WHERE id = '4cb293c8-b8e2-4a0a-9198-5427d937ff84';
UPDATE public.checklist_items SET content = '버스 탑승지 확정', source = '25-2: 600주년 기념관 앞' WHERE id = '341a9b9e-a592-4c8a-8d44-5cc34f1925aa';
UPDATE public.checklist_items SET content = '버스 탑승 명단 작성 (교환담당팀에서 전달)', source = NULL WHERE id = '902c4cc4-9307-4159-b3cf-09f4a1b2a4d4';
UPDATE public.checklist_items SET content = '버스 2대 분할 기준 (팀별? 캠퍼스별?)', source = NULL WHERE id = '85b876e6-721c-43ec-bcad-a860a5a35747';
UPDATE public.checklist_items SET content = '상차 6 / 탑승안내 10 인력 배정 (오전)', source = NULL WHERE id = '9d8d8b33-22b7-44c8-9041-53f35df2c8f6';
UPDATE public.checklist_items SET content = '귀환 셔틀 위치 확정', source = '25-2: 수성관 5동 & 주차장 사이, N센터 앞' WHERE id = '977a7592-4670-48f1-9168-9166835362b2';
UPDATE public.checklist_items SET content = '오후 상차 3 / 탑승안내 4 인력 배정', source = NULL WHERE id = 'bc03aa7f-c0fb-4f36-b22b-c326e87c729a';
UPDATE public.checklist_items SET content = '버스 대기 중 프로그램 검토 (도착 시간차 이슈)', source = NULL WHERE id = 'fbae130d-4016-44c2-8f72-80ecdb74bc11';
UPDATE public.checklist_items SET content = '율전 도착 후 인솔 동선 (입장관리존까지)', source = NULL WHERE id = '07f66d1b-a61f-4640-8482-2307ba2582f3';
UPDATE public.checklist_items SET content = '사회자는 영어 편한 사람 배정 (26-1 호평, 25-2에도 적용)', source = NULL WHERE id = 'd6176869-d975-455f-b3a8-7b86971160c6';
UPDATE public.checklist_items SET content = '심판 역할 배정은 최소 3일 전 (작년: 전날 배정으로 숙지 부족)', source = NULL WHERE id = '41052cc7-bddb-4112-b6ae-652c8456ac23';
UPDATE public.checklist_items SET content = '명륜조/율전조 도착 시간 차이 최소화 (율전조 선행 세팅으로 해결)', source = NULL WHERE id = '5c03e10c-5c77-405f-9355-0e718cbb1603';
UPDATE public.checklist_items SET content = '입장 시 팀별 노래 + 팀장 깃발 (팀워크)', source = NULL WHERE id = '16fb1ade-296b-47ed-83ca-dd25f9c70c8c';
UPDATE public.checklist_items SET content = '점수 집계 노트북 필수 (25-2)', source = NULL WHERE id = '09753407-4f57-4d9e-b446-63a6cd33862d';
UPDATE public.checklist_items SET content = '개회 K-pop BGM 팀별 입장 (25-2)', source = NULL WHERE id = '222f895b-5f10-4cc6-bdcd-41c8b11f2ae8';
UPDATE public.checklist_items SET content = '국민체조 시범 편성 (25-2, 13:00~13:30)', source = NULL WHERE id = '69d99fc1-8db6-45e9-806e-bc93b705dbed';
UPDATE public.checklist_items SET content = '귀환 셔틀 18:30 고정', source = '25-2: 수성관 5동 & 주차장 사이, N센터 앞' WHERE id = 'ea499b92-b929-4bca-9ff8-3d473454f5eb';
UPDATE public.checklist_items SET content = '하클 가용인원 조사', source = NULL WHERE id = '9f201b9c-46f0-407c-a5c7-a150fe470c84';
UPDATE public.checklist_items SET content = '컨텐츠팀 게임 소요시간 수령 (8/16 이후) → 1부/2부 시간 미세조정', source = NULL WHERE id = '771fe712-ab46-40b3-942e-33ca571504c8';
UPDATE public.checklist_items SET content = '교환 팀 배정 결과 수령 (9/3) → 팀장 6명 확정', source = NULL WHERE id = '5f75fe73-df32-4859-8891-dde88649218d';
UPDATE public.checklist_items SET content = '전체 타임라인 완성 (8/13, 25-2 베이스 차용)', source = NULL WHERE id = '4712bc8b-ee4e-4b18-b337-d10acbc2a388';
UPDATE public.checklist_items SET content = '하클 역할 배치표 작성 (48명, 버스 23명 별도 풀)', source = NULL WHERE id = 'ec7617cb-3690-4a2f-905f-49c6d4078754';
UPDATE public.checklist_items SET content = '심판 배정표 (최소 3일 전)', source = NULL WHERE id = 'f5c6e9fa-e63a-4134-b708-bb0fa39345b9';
UPDATE public.checklist_items SET content = '명륜→율전 버스 운영 계획서 (이중 집합 + 귀환 셔틀 포함)', source = NULL WHERE id = 'f562615b-5b35-49fa-bc7a-ecff1624408c';
UPDATE public.checklist_items SET content = '버스 인력 23명 배정 (오전 16 / 오후 7)', source = NULL WHERE id = 'd991a897-49e2-48d4-96fb-65b06739ba1a';
UPDATE public.checklist_items SET content = '행사 당일 타임라인 시트 작성 (최종기획안)', source = NULL WHERE id = 'be460d84-b20a-4e57-af4c-ae9978f90c92';

COMMIT;

-- ═══════════ 0010_reflect_2nd_meeting.sql ═══════════
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

-- ═══════════ 0011_complete_2nd_meeting_checklists.sql ═══════════
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

-- ═══════════ 0012_milestone_completion_trigger.sql ═══════════
-- 0012: 마일스톤 completed 자동동기화를 DB 트리거로 이관
-- spec: docs/superpowers/specs/2026-08-12-마일스톤-완료-DB트리거-design.md
-- 기존 클라이언트(lib/milestone-sync.ts)를 대체 — 모든 checklist_items 쓰기 경로를
-- 트랜잭션 단위로 커버. 동작은 기존과 동일(책임만 이관).

BEGIN;

-- ===== (1) 핵심 재계산 로직 — 1개 마일스톤 completed를 현재 자식 상태 기준으로 갱신 =====
-- 트리거·백필·디버그가 공유. security definer로 호출자 RLS와 무관하게 DB 불변조건 유지.
create or replace function public.recompute_milestone(p_id uuid)
returns void as $$
declare
  total int;
  done int;
  cur_completed boolean;
begin
  -- 자식 체크리스트(soft-delete 제외) 집계
  select count(*), count(*) filter (where completed)
    into total, done
    from public.checklist_items
    where milestone_id = p_id
      and deleted_at is null;

  -- 현재 마일스톤 completed
  select completed into cur_completed
    from public.milestones
    where id = p_id;
  if not found then
    return;  -- 마일스톤이 없으면(삭제됨) noop
  end if;

  -- 순수 마일스톤(자식 없음) = 사용자 직접 관리 → 건드리지 않음
  if total = 0 then
    return;
  end if;

  -- 멱등: 실제로 바뀔 때만 UPDATE
  if done = total then
    if coalesce(cur_completed, false) is false then
      update public.milestones set completed = true where id = p_id;
    end if;
  else
    if coalesce(cur_completed, false) is true then
      update public.milestones set completed = false where id = p_id;
    end if;
  end if;
end;
$$ language plpgsql
  security definer
  set search_path = public, pg_temp;

-- ===== (2) 트리거 함수 — NEW/OLD에서 영향받은 마일스톤 추출해 recompute 호출(중복제거) =====
create or replace function public.sync_milestone_completion()
returns trigger as $$
begin
  -- UPDATE/DELETE: OLD.milestone_id
  if tg_op in ('UPDATE','DELETE') and old.milestone_id is not null then
    perform public.recompute_milestone(old.milestone_id);
  end if;

  -- INSERT/UPDATE: NEW.milestone_id (UPDATE이고 OLD와 같으면 위에서 처리했으므로 skip)
  if tg_op in ('INSERT','UPDATE') and new.milestone_id is not null then
    if not (tg_op = 'UPDATE' and old.milestone_id is not distinct from new.milestone_id) then
      perform public.recompute_milestone(new.milestone_id);
    end if;
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql;

-- ===== (3) 트리거 부착 (재실행 안전) =====
drop trigger if exists trg_sync_milestone_completion on public.checklist_items;
create trigger trg_sync_milestone_completion
  after insert or update or delete on public.checklist_items
  for each row execute function public.sync_milestone_completion();

-- ===== (4) 1회성 백필 — 현재 checklist 상태 기준으로 모든 마일스톤 재동기화 =====
-- 과거 클라이언트 sync가 놓친 부정합(trash-view류) 보정 → 트리거가 깨끗한 기저에서 시작.
-- milestones 직접 UPDATE이므로 checklist 트리거는 발화하지 않음.
select public.recompute_milestone(id) from public.milestones where deleted_at is null;

COMMIT;

-- ═══════════ 0013_drive_files_created_time.sql ═══════════
-- 0013: 전체 팀 파일 피드 — 신규/수정 구분용 created_time 캡처
-- 기존 행은 null로 시작, 다음 동기화 upsert 시 값이 채워진다.
BEGIN;

alter table public.drive_files
  add column if not exists created_time timestamptz;

COMMIT;

-- ═══════════ 0014_handoffs.sql ═══════════
-- 0014: 인계(handoffs) 추적 — 팀 간 파일 공유 2단계
-- 스펙: docs/superpowers/specs/2026-08-18-인계추적-design.md
-- 시드의 체크리스트 링크 ID는 0005 기준. 1차(8/16)는 지연 배지로 즉시 노출 — 의도됨.

BEGIN;

create table public.handoffs (
  id uuid primary key default gen_random_uuid(),
  from_team_id text not null references public.teams(id),
  to_team_id text references public.teams(id),
  to_external text,
  title text not null,
  due_date date,
  completed boolean not null default false,
  checklist_item_id uuid references public.checklist_items(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint handoffs_to_exactly_one check (
    (to_team_id is not null and to_external is null) or
    (to_team_id is null and to_external is not null)
  )
);

create index if not exists idx_handoffs_due on public.handoffs(due_date);
create index if not exists idx_handoffs_completed on public.handoffs(completed);

alter table public.handoffs enable row level security;
create policy "handoffs_open_read"  on public.handoffs for select using (true);
create policy "handoffs_open_write" on public.handoffs for insert with check (true);
create policy "handoffs_open_edit"  on public.handoffs for update using (true);
create policy "handoffs_open_del"   on public.handoffs for delete using (true);

-- 감사 트리거 (0003 audit_capture 재사용 — audit_log에 team_id 컬럼 없음, 기존 5테이블과 동일하게 미기록)
drop trigger if exists trg_audit_handoffs on public.handoffs;
create trigger trg_audit_handoffs
  after insert or update or delete on public.handoffs
  for each row execute function public.audit_capture();

-- ===== 초기 시드 5건 (기존 체크리스트 인계 항목에서 추출, 전부 미완료) =====
insert into public.handoffs
  (id, from_team_id, to_team_id, to_external, title, due_date, completed, checklist_item_id, sort_order)
values
  ('11111111-1111-4111-8111-111111111111', 'content',   'budget',   null,     '게임별 필요 인원·물품 리스트',      '2026-08-16', false, '728a5f1a-3033-48b4-8e3b-7f7ec74f16b1', 1),
  ('22222222-2222-4222-8222-222222222222', 'content',   'exchange', null,     '컨텐츠 안내 (카드뉴스용)',           null,          false, '8cc9ec56-98d1-4de3-8a94-d80d3b054e54', 2),
  ('33333333-3333-4333-8333-333333333333', 'exchange',  null,       '홍보부', '카드뉴스 홍보부 인계물 (1차)',      '2026-08-18', false, '40f95907-b1b2-43da-9a4d-3fe619c51d9f', 3),
  ('44444444-4444-4444-8444-444444444444', 'exchange',  null,       '홍보부', '카드뉴스 홍보부 인계물 (2차)',      '2026-08-30', false, '40f95907-b1b2-43da-9a4d-3fe619c51d9f', 4),
  ('55555555-5555-4555-8555-555555555555', 'exchange',  'timeline', null,     '버스 탑승 명단',                     null,          false, '902c4cc4-9307-4159-b3cf-09f4a1b2a4d4', 5);

COMMIT;

-- ═══════════ 0015_reflect_exchange_form_update.sql ═══════════
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

-- ═══════════ 0016_reflect_intl_support_and_updates.sql ═══════════
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

-- ═══════════ 0017_update_deficit_principle_to_intl_support.sql ═══════════
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

-- ═══════════ 0018_merge_checklist_into_milestones.sql ═══════════
-- 0018: checklist_items를 milestones로 병합 (UUID 보존)
-- plan: docs/superpowers/plans/2026-08-22-merge-checklist-into-milestones.md
--
-- 검증 노트 (기존 마이그레이션 대조):
-- - handoffs FK 제약명은 0014에서 inline 정의되어 Postgres 자동 명명 규칙에 따라
--   `handoffs_checklist_item_id_fkey`로 생성됨 → 아래 drop constraint 이름과 일치
-- - 0012의 트리거/함수 이름(trg_sync_milestone_completion,
--   sync_milestone_completion(), recompute_milestone(uuid)) 확인 후 DROP
-- - checklist_items의 나머지 의존 객체(trg_checklist_updated, trg_audit_checklist_items,
--   RLS policy, checklist_items_milestone_id_fkey)는 drop table이 함께 정리
-- - milestones에는 touch_updated_at(0001)·audit_capture(0003) 트리거가 이미 존재 → 유지

begin;

-- 백업 (롤백 가능성 대비) — anon/authenticated 접근 차단(PostgREST 노출 방지)
create table public.checklist_items_backup_0018 as select * from public.checklist_items;
create table public.milestones_backup_0018 as select * from public.milestones;
revoke all on public.checklist_items_backup_0018 from anon, authenticated;
revoke all on public.milestones_backup_0018 from anon, authenticated;

-- 스키마 확장
alter table public.milestones
  add column if not exists priority text,
  add column if not exists source text;
alter table public.milestones
  add constraint milestones_priority_check check (priority in ('high','medium','low'));
alter table public.milestones alter column date drop not null;

-- 완료 자동 동기화 트리거 제거 (자식 테이블 소멸)
drop trigger if exists trg_sync_milestone_completion on public.checklist_items;
drop function if exists public.sync_milestone_completion();
drop function if exists public.recompute_milestone(uuid);

-- 체크리스트 항목 이관 (원래 UUID 유지 → handoffs FK 데이터 그대로 유효)
insert into public.milestones (id, date, title, team_id, category, completed, depends_on, sort_order, priority, source, updated_at, deleted_at)
select ci.id,
       m.date,
       ci.content,
       ci.team_id,
       'deliverable',
       ci.completed,
       null::uuid[],
       ci.sort_order,
       ci.priority,
       ci.source,
       coalesce(ci.updated_at, now()),
       ci.deleted_at
from public.checklist_items ci
left join public.milestones_backup_0018 m on ci.milestone_id = m.id
on conflict (id) do nothing;

-- 인계 FK 재지향 (같은 UUID를 참조하므로 데이터 무변경)
alter table public.handoffs drop constraint if exists handoffs_checklist_item_id_fkey;
alter table public.handoffs rename column checklist_item_id to item_id;
alter table public.handoffs
  add constraint handoffs_item_id_fkey
  foreign key (item_id) references public.milestones(id) on delete set null;

-- 조회 빈도 대비 인덱스 (기존 idx_handoffs_due/completed와 동일 패턴)
create index if not exists idx_handoffs_item_id on public.handoffs(item_id);

-- 구 테이블 제거 (FK·트리거는 drop table이 함께 정리)
drop table public.checklist_items;

commit;

-- ═══════════ 0019_milestones_insert_lock.sql ═══════════
-- 체크리스트(milestones) 신규 항목 추가 잠금
-- 배경: 2026-08-22 중복 5쌍 정리로 항목 수 확정. 새 항목 추가는 총괄의 직접 지시가 있을 때만 수행.
-- 기존 항목의 내용 수정(제목·기한·하위 내용)과 완료 체크는 계속 자유.

create table if not exists app_locks (
  key text primary key,
  locked boolean not null default true,
  note text
);

insert into app_locks (key, locked, note)
values (
  'milestones_insert',
  true,
  '체크리스트 항목 추가 잠금. 해제: update app_locks set locked = false where key = ''milestones_insert'';'
)
on conflict (key) do nothing;

create or replace function block_milestones_insert() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from app_locks where key = 'milestones_insert' and locked) then
    raise exception 'CHECKLIST_LOCKED: 신규 체크리스트 항목 추가가 잠겨 있습니다 (app_locks.milestones_insert). 기존 항목의 수정·완료 체크는 가능합니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists milestones_insert_lock on milestones;
create trigger milestones_insert_lock before insert on milestones
for each row execute function block_milestones_insert();

-- ═══════════ 0020_bot_runs.sql ═══════════
-- 단체방 봇(PC 스크립트) 실행 보고 기록 — watchdog이 '오늘 보고 없음'을 감지하는 근거.
create table if not exists public.bot_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  status text not null check (status in ('success', 'fail')),
  detail text,
  created_at timestamptz not null default now()
);

alter table public.bot_runs enable row level security;

create index if not exists bot_runs_run_date_idx on public.bot_runs (run_date);

-- ═══════════ demo/002_demo_seed.sql (실제 데이터 제거 + 가상 데이터) ═══════════
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
  ('demo-d1', '행사 컨셉 선정',      array['레트로 스포츠데이','미니 올림픽','동아리 축제'], 'confirmed',  '미니 올림픽', '2026-10-02', 1, '기획 회의에서 확정 (예시)'),
  ('demo-d2', '개막 행사 형식',      array['퍼레이드','카운트다운','공동 워밍업'],           'confirmed',  '공동 워밍업', '2026-10-09', 2, null),
  ('demo-d3', '대표 게임 5종',       array['릴레이','풋살','줄다리기','오목','퀴즈'],       'discussing', null,          null,        3, '팀별 의견 수렴 중 (예시)'),
  ('demo-d4', '우천 시 진행 계획',   array['실내 프로그램 전환','일정 연기'],               'pending',    null,          null,        4, null),
  ('demo-d5', '폐막 시상 형식',      array['전체 시상','팀별 시상'],                        'pending',    null,          null,        5, null);

-- ===== 마일스톤 (가상 일정) =====
insert into public.milestones (date, title, team_id, category, completed, sort_order) values
  ('2026-10-05', '전체 기획안 초안 작성',           'demo-planning',  'deliverable', true,  1),
  ('2026-10-12', '예시 예산 구조 확정',             'demo-planning',  'deliverable', true,  2),
  ('2026-10-19', '게임 규칙집 초안',                'demo-content',   'deliverable', true,  3),
  ('2026-10-26', '진행 스크립트 v1',                'demo-content',   'deliverable', true,  4),
  ('2026-11-02', '물품 견적 요청 발송',             'demo-logistics', 'deliverable', true,  5),
  ('2026-11-09', '안전 대응 매뉴얼 초안',           'demo-safety',    'deliverable', false, 6),
  ('2026-11-09', '홍보 포스터 시안 1차',            'demo-record',    'deliverable', false, 7),
  ('2026-11-16', '주간 기획 회의 (#5)',             'demo-planning',  'meeting',     false, 8),
  ('2026-11-30', '설치 리허설',                     'demo-logistics', 'event',       false, 9),
  ('2026-12-07', '최종 점검 회의',                  'demo-planning',  'meeting',     false, 10),
  ('2026-12-14', '행사 당일 (가상)',                'demo-planning',  'event',       false, 11);

-- ===== 이슈 (가상) =====
insert into public.issues (team_id, date, title, status, notes) values
  ('demo-content',   '2026-11-01', '게임 5종 확정 지연 — 팀 의견 수렴 필요', 'in_progress', '차주 회의에서 결정 (예시)'),
  ('demo-logistics', '2026-11-05', '일부 물품 리드타임 길어짐',             'open',        null),
  ('demo-safety',    '2026-10-28', '응급 연락망 양식 초안 공유 완료',       'resolved',    null);

-- ===== 인계 (가상) =====
insert into public.handoffs (from_team_id, to_team_id, to_external, title, due_date, completed, sort_order) values
  ('demo-planning', 'demo-content',   null,          '확정된 컨셉 브리프 전달',        '2026-10-08', true,  1),
  ('demo-content',  'demo-record',    null,          '게임 규칙집 홍보용 요약본',      '2026-11-10', false, 2),
  ('demo-planning', null,             '가상 협력업체', '설치 지원 요청서',              '2026-11-20', false, 3),
  ('demo-safety',   'demo-planning',  null,          '안전 유의사항 스크립트 반영 요청', '2026-11-25', false, 4);

-- 시딩으로 쌓인 감사 로그 정리 + 삽입 잠금 복원
truncate public.audit_log;
update public.app_locks set locked = true where key = 'milestones_insert';

commit;

-- ===== 확인용 =====
-- select (select count(*) from teams) teams, (select count(*) from milestones) milestones,
--        (select count(*) from decisions) decisions, (select count(*) from handoffs) handoffs;
-- 기대값: teams=5, milestones=11, decisions=5, handoffs=4

-- ═══════════ demo/001_demo_readonly_rls.sql (읽기전용 강제) ═══════════
-- 데모 인스턴스 전용 RLS — 반드시 "데모 Supabase 프로젝트"에서만 실행할 것.
-- 운영 프로젝트에 실행하면 기획팀의 쓰기가 전부 막힌다. (운영 정책은 0002_rls_policies.sql)
--
-- 효과: anon은 모든 테이블을 읽기만 가능. insert/update/delete 정책을 제거해
-- anon key를 알아도 직접 쓰기가 불가능해진다 (RLS가 강제).

-- ===== 쓰기 정책 제거 (읽기 정책은 유지) =====
drop policy if exists "teams_open_write"        on public.teams;
drop policy if exists "teams_open_edit"         on public.teams;
drop policy if exists "teams_open_del"          on public.teams;

drop policy if exists "decisions_open_write"    on public.decisions;
drop policy if exists "decisions_open_edit"     on public.decisions;
drop policy if exists "decisions_open_del"      on public.decisions;

drop policy if exists "milestones_open_write"   on public.milestones;
drop policy if exists "milestones_open_edit"    on public.milestones;
drop policy if exists "milestones_open_del"     on public.milestones;

-- checklist_items는 0018에서 삭제된 테이블 — 정책 제거 불필요

drop policy if exists "issues_open_write"       on public.issues;
drop policy if exists "issues_open_edit"        on public.issues;
drop policy if exists "issues_open_del"         on public.issues;

drop policy if exists "handoffs_open_write"     on public.handoffs;
drop policy if exists "handoffs_open_edit"      on public.handoffs;
drop policy if exists "handoffs_open_del"       on public.handoffs;

drop policy if exists "drive_files_open_write"  on public.drive_files;
drop policy if exists "drive_files_open_edit"   on public.drive_files;
drop policy if exists "drive_files_open_del"    on public.drive_files;

-- ===== 감사 로그 쓰기 차단 =====
drop policy if exists "audit_open_write"        on public.audit_log;

-- ===== 구글 드라이브 토큰: 데모에는 연동 자체가 없으므로 쓰기도 차단 =====
drop policy if exists "tokens_write"            on public.drive_tokens;
drop policy if exists "tokens_update"           on public.drive_tokens;
drop policy if exists "tokens_delete"           on public.drive_tokens;
