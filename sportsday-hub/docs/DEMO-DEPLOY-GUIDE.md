# 읽기 전용 데모 인스턴스 배포 가이드

> **2026-08-31 전 단계 배포 완료** (Supabase CLI + Vercel CLI)
> - 데모 URL: **https://sportsday-hub-demo.vercel.app**
> - Supabase: `sportsday-hub-demo` · ref `chjivyricnzfewfgtqnz` · ap-northeast-2(서울)
> - Vercel: `sportsday-hub-demo` (prj_9hk4EWhqoa9hLBM4m7taluQF16bb, 팀 f10w3r-13s-projects)
> - 검증: 데모 배너 표시 · 가상 데이터(예산/실명/구글독스 0건) · `/settings` 307 차단 · anon 쓰기 RLS 차단
> - CLI 재현 시 주의 3가지:
>   1. 마이그레이션 순서: **0006(audit 트리거 소문자 수정)을 0005(시드)보다 먼저** 적용 (0006은 중복 적용 무해)
>   2. CLI로 프로젝트 생성 시 Framework Preset이 "Other"가 되므로 `vercel project update <name> --framework nextjs` 후 배포
>   3. 신규 프로젝트는 SSO 배포 보호가 기본 켜짐 → `vercel project protection disable <name> --sso`
> - 데모 갱신 방법: 시드 데이터 변경은 `supabase/db query --linked`로 002 재실행(재배포 불필요).
>   코드 변경 반영은 이 디렉터리에서 `vercel link --project sportsday-hub-demo` 후 `vercel deploy --prod`
>   (배포 후 `.vercel` 원복 잊지 말 것 — 이 디렉터리의 기본 링크는 운영 sportsday-hub).
> - `.vercelignore`가 데모/CLI 업로드에서 내부 자료(content-source, docs, supabase 등)를 제외한다.

포트폴리오에서 보여줄 **가상 데이터 + 읽기 전용** 데모를 운영 서비스와 분리하여 배포하는 절차.
운영(`sportsday-hub.vercel.app`)과 기획팀 실제 데이터에는 영향이 없다.

## 왜 분리하는가

- 운영 인스턴스는 로그인 없이 실제 예산·계정명·구글 드라이브 링크가 노출된다 (2026-08-31 실측).
- 마이그레이션 RLS(0002)는 "anon 전권"(누구나 읽고 쓰고 지움)이라 UI만 잠가도 우회 가능.
- 따라서 **별도 데모 Supabase 프로젝트(가상 데이터, 쓰기 차단 RLS) + 별도 Vercel 프로젝트(DEMO_MODE)** 로 분리한다.

## 구성 요소 (이 저장소에 추가된 것)

| 파일 | 역할 |
|---|---|
| `lib/demo.ts` | `NEXT_PUBLIC_DEMO_MODE=1`일 때만 동작. 클라이언트 쓰기(insert/update/upsert/delete) 차단 |
| `lib/supabase/client.ts` | `createClient()`에 데모 쓰기 가드 적용 (운영은 무동작) |
| `components/demo-banner.tsx` | "읽기 전용 데모 — 가상 데이터" 상단 배너 (운영에서는 렌더 안 됨) |
| `app/settings/page.tsx` | 데모에서 설정(구글 드라이브 연동) 페이지 접근 차단 |
| `supabase/demo/002_demo_seed.sql` | 실제 데이터를 비우고 가상 데이터 적재 |
| `supabase/demo/001_demo_readonly_rls.sql` | anon 쓰기 정책 제거 → 읽기 전용 강제 |

## 배포 절차

### 1단계 — 데모 Supabase 프로젝트 만들기

1. https://supabase.com → New project (예: `sportsday-hub-demo`)
2. SQL Editor에서 **스키마 마이그레이션 전부**를 순서대로 실행
   (`supabase/migrations/0001` ~ `0020` — 실제 시드 데이터가 들어오지만 다음 단계에서 비워진다)
3. `supabase/demo/002_demo_seed.sql` 실행 → 실제 데이터 제거 + 가상 데이터 적재
4. `supabase/demo/001_demo_readonly_rls.sql` 실행 → 읽기 전용 강제
5. Project Settings → API에서 `Project URL`, `anon key` 복사

⚠️ **001/002 SQL은 절대 운영 프로젝트에서 실행하지 않는다.**
운영에서 실행하면 기획팀 쓰기가 막히고 실제 데이터가 사라진다.

검증: SQL Editor에서
```sql
update public.decisions set current_value = 'x' where id = 'demo-d1';
-- → RLS 오류가 나면 정상 (읽기 전용 확인)
```

### 2단계 — 데모 Vercel 프로젝트 만들기

1. Vercel → Add New Project → 같은 저장소 연결 (별도 프로젝트명: `sportsday-hub-demo`)
2. Environment Variables 설정:
   - `NEXT_PUBLIC_SUPABASE_URL` = 1단계에서 복사한 데모 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 데모 프로젝트 anon key
   - `NEXT_PUBLIC_DEMO_MODE` = `1`
   - (서버용 `SUPABASE_SERVICE_ROLE_KEY` 등이 있다면 데모 프로젝트 것으로 — drive/sync는 데모에서 사용 안 함)
3. Deploy → 배포된 URL 확인 (예: `sportsday-hub-demo.vercel.app`)
4. 확인: 상단에 "읽기 전용 데모" 배너, 체크박스 클릭 시 안내 문구, 설정 페이지 접속 시 메인으로 리다이렉트

### 3단계 — 포트폴리오 링크 교체

`50 포트폴리오 사이트/portfolio/data/content.js` → `sportsday-hub` 프로젝트의
`links.demo`를 데모 URL로 교체 (운영 URL은 다시는 노출하지 않는다).

### 4단계 — 운영 인스턴스 (별도 논의, 지금은 그대로)

운영 서버의 근본 해결은 팀 인증(비밀번호/링크 토큰 + RLS) 추가.
기획팀 전원의 접근 방식이 바뀌므로 팀 합의 후 진행한다.
그 전까지는 포트폴리오 등 외부 링크에서 운영 URL을 제거하는 것으로 노출 경로를 차단한다.

## 데모 데이터 갱신

가상 데이터를 바꾸고 싶으면 데모 프로젝트 SQL Editor에서 `002_demo_seed.sql`을 다시 실행하면 된다
(TRUNCATE 후 재적재). 스키마가 바뀐 마이그레이션이 추가되면 데모 프로젝트에도 해당 마이그레이션을 적용한다.
