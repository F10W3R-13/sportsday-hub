# 카카오톡 단체방 봇 신뢰성 구조 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단체방 봇(PC UI 자동화)의 모든 실패 모드를 감지하고 즉시 총괄 카카오톡("나에게 보내기", 공식 API)으로 경보를 보내는 4레이어 신뢰성 구조를 구축한다.

**Architecture:** PC 스크립트가 성공/실패를 서버에 보고하면 서버가 `bot_runs` 테이블에 기록하고, 실패 보고 시 즉시 경보 메모를 발송한다. 18:10 KST Vercel 크론(watchdog)이 오늘 보고 없음을 감지하면 미실행 경보를 발송한다. 모든 경보에는 수동 폴백용 다이제스트 전문을 포함한다. 카카오 메모 발송 로직은 기존 크론 라우트에서 lib로 추출해 3개 소비처가 공유한다.

**Tech Stack:** Next.js 16 App Router(기존), Supabase(마이그레이션 0020), Vercel Crontab, Python(PyAutoGUI 스크립트 고도화), Vitest

## Global Constraints

- 카카오 메모('나에게 보내기') 텍스트 제한 200자 초과분은 전송 실패한다 — 경보 메시지는 다이제스트를 포함하므로 **잘라내기 방식**으로 200자 안에 맞춘다(다이제스트 전문이 200자를 넘으면 사유 요약만 발송).
- 모든 신규 API는 `CRON_SECRET` Bearer 인증 필수(기존 크론과 동일 패턴: 미설정 시 통과).
- `milestones` INSERT는 잠금 상태(마이그레이션 0019). 본 플랜은 milestones에 INSERT하지 않는다.
- 커밋 메시지·주석·문구는 한국어(기존 컨벤션).
- 테스트 게이트: `npx tsc --noEmit` + `npx vitest run` 전부 통과 후 커밋.
- 배포는 git push 통해서만(vercel CLI 직접 배포 불가).

---

### Task 1: 카카오 메모 발송 lib 추출

**Files:**
- Create: `sportsday-hub/lib/kakao-memo.ts`
- Modify: `sportsday-hub/app/api/cron/kakao-digest/route.ts` (내부 함수 2개 제거 → lib import)
- Test: 없음(순수 이동 리팩터, 기존 크론 동작은 Task 7 배포 후 프로덕션으로 검증)

**Interfaces:**
- Produces: `sendMemoViaEnv(text: string): Promise<{ sent: boolean; dryRun?: boolean; error?: string }>` — KAKAO_CLIENT_ID/KAKAO_REFRESH_TOKEN 미설정 시 `{ sent: false, dryRun: true }`, 발송 성공 시 `{ sent: true }`, 실패 시 throw하지 않고 `{ sent: false, error }` 반환(경보 경로에서 재시도 없이 결과 보고용).

- [ ] **Step 1: lib/kakao-memo.ts 작성** — `app/api/cron/kakao-digest/route.ts:53-88`의 `refreshKakaoToken`·`sendKakaoMemo`를 이동 + `sendMemoViaEnv` 추가:

```ts
/** 카카오톡 '나에게 보내기' 공통 모듈 — 크론·봇 보고·watchdog이 공유. */

/** 리프레시 토큰으로 액세스 토큰 발급. 매일 실행되므로 리프레시 토큰도 함께 연장된다. */
async function refreshKakaoToken(clientId: string, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken })
  if (process.env.KAKAO_CLIENT_SECRET) body.set('client_secret', process.env.KAKAO_CLIENT_SECRET)

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new Error(`kakao token refresh 실패 (${res.status}): ${await res.text()}`)
  }
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

/** 카카오톡 '나에게 보내기' — 텍스트 템플릿. */
async function sendKakaoMemo(accessToken: string, text: string): Promise<void> {
  const template = {
    object_type: 'text' as const,
    text,
    link: { web_url: 'https://sportsday-hub.vercel.app' },
  }
  const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
  })
  if (!res.ok) {
    throw new Error(`kakao memo send 실패 (${res.status}): ${await res.text()}`)
  }
}

/** env 기반 메모 발송. 토큰 미설정 시 dry-run(발송 생략). */
export async function sendMemoViaEnv(text: string): Promise<{ sent: boolean; dryRun?: boolean; error?: string }> {
  const clientId = process.env.KAKAO_CLIENT_ID
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN
  if (!clientId || !refreshToken) return { sent: false, dryRun: true }
  try {
    const accessToken = await refreshKakaoToken(clientId, refreshToken)
    await sendKakaoMemo(accessToken, text)
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) }
  }
}
```

- [ ] **Step 2: cron route에서 내부 함수 삭제하고 import로 교체** — `app/api/cron/kakao-digest/route.ts`에서 `refreshKakaoToken`·`sendKakaoMemo` 함수 정의(53행~끝) 제거하고, 37-46행의 dry-run 분기 포함 발송부를:

```ts
    const result = await sendMemoViaEnv(digest.text)
    if (!result.sent && result.error) throw new Error(result.error)
    if (!result.sent && result.dryRun) {
      return NextResponse.json({ sent: false, dryRun: true, text: digest.text, total: digest.total })
    }
    return NextResponse.json({ sent: true, total: digest.total, text: digest.text })
```

상단에 `import { sendMemoViaEnv } from '@/lib/kakao-memo'` 추가.

- [ ] **Step 3: 게이트** — Run: `npx tsc --noEmit && npx vitest run tests/kakao-digest.test.ts`
  Expected: 에러 0 / 8 passed

- [ ] **Step 4: 커밋** — `git add lib/kakao-memo.ts app/api/cron/kakao-digest/route.ts && git commit -m "refactor: 카카오 메모 발송 lib 추출 — 크론·봇 보고·watchdog 공용"`

---

### Task 2: bot_runs 테이블 마이그레이션

**Files:**
- Create: `sportsday-hub/supabase/migrations/0020_bot_runs.sql`

**Interfaces:**
- Produces: 테이블 `public.bot_runs(id uuid pk, run_date date not null, status text not null check in('success','fail'), detail text, created_at timestamptz default now())` — RLS 활성화(정책 없음 = service key만 접근).

- [ ] **Step 1: 마이그레이션 작성**

```sql
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
```

- [ ] **Step 2: 원격 적용** — Run: `npx supabase db push`
  Expected: `Applying migration 0020_bot_runs.sql... Finished`

- [ ] **Step 3: 커밋** — `git add supabase/migrations/0020_bot_runs.sql && git commit -m "feat: bot_runs 테이블 — 단체방 봇 실행 보고 기록"`

---

### Task 3: 봇 경보 헬퍼 (TDD)

**Files:**
- Create: `sportsday-hub/lib/kakao-bot.ts`
- Test: `sportsday-hub/tests/kakao-bot.test.ts`

**Interfaces:**
- Consumes: 없음(자체 포함)
- Produces:
  - `kstTodayDate(now?: Date): string` — KST 오늘 'YYYY-MM-DD'
  - `kstClockLabel(now?: Date): string` — KST 'M/D(요일) HH:mm'
  - `buildBotAlert(kind: 'fail' | 'watchdog', detail: string | null, digestText: string | null): string` — 200자 이내 경보 텍스트. 다이제스트가 들어갈 수 있으면 포함, 아니면 링크 안내로 축약.

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, it, expect } from 'vitest'
import { kstTodayDate, kstClockLabel, buildBotAlert } from '@/lib/kakao-bot'

const NOW = new Date('2026-08-23T09:30:00Z') // KST 8/23(일) 18:30

describe('kakao-bot 헬퍼', () => {
  it('KST 오늘 날짜', () => {
    expect(kstTodayDate(NOW)).toBe('2026-08-23')
  })
  it('KST 시각 라벨', () => {
    expect(kstClockLabel(NOW)).toContain('8/23(일)')
    expect(kstClockLabel(NOW)).toContain('18:30')
  })
  it('fail 경보: 짧은 다이제스트는 전문 포함, 200자 이내', () => {
    const text = buildBotAlert('fail', '카카오톡 창을 찾을 수 없습니다', '[스포츠데이 오늘의 할 일 8/23(일)]\n8/25(화) 마감 4건')
    expect(text).toContain('단체방 자동 발송 실패')
    expect(text).toContain('카카오톡 창을 찾을 수 없습니다')
    expect(text).toContain('8/25(화) 마감 4건')
    expect(text.length).toBeLessThanOrEqual(200)
  })
  it('fail 경보: 다이제스트가 길면 사유+링크로 축약', () => {
    const longDigest = 'x'.repeat(300)
    const text = buildBotAlert('fail', '전송 오류', longDigest)
    expect(text).toContain('단체방 자동 발송 실패')
    expect(text).not.toContain('xxx')
    expect(text.length).toBeLessThanOrEqual(200)
    expect(text).toContain('sportsday-hub.vercel.app')
  })
  it('watchdog 경보: 미실행 안내 + 다이제스트 포함', () => {
    const text = buildBotAlert('watchdog', null, '[스포츠데이 오늘의 할 일 8/23(일)]\n오늘 마감 없음')
    expect(text).toContain('실행되지 않았습니다')
    expect(text).toContain('PC 전원·로그인·카카오톡 상태')
    expect(text).toContain('오늘 마감 없음')
  })
  it('watchdog 경보: 다이제스트 null이면 링크 안내', () => {
    const text = buildBotAlert('watchdog', null, null)
    expect(text).toContain('실행되지 않았습니다')
    expect(text).toContain('sportsday-hub.vercel.app')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/kakao-bot.test.ts`
  Expected: FAIL (module not found)

- [ ] **Step 3: 구현**

```ts
const DOW = ['일', '월', '화', '수', '목', '금', '토']

/** KST 오늘 날짜 'YYYY-MM-DD' (봇 보고·watchdog 조회의 run_date 기준). */
export function kstTodayDate(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/** KST 시각 라벨 'M/D(요일) HH:mm' (경보 헤더용). */
export function kstClockLabel(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mm = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}(${DOW[kst.getUTCDay()]}) ${hh}:${mm}`
}

const SITE_URL = 'https://sportsday-hub.vercel.app'
const KAKAO_TEXT_LIMIT = 200

/**
 * 봇 이상 경보 텍스트(카카오 메모 200자 제한 준수).
 * 가능하면 수동 폴백용 다이제스트 전문을 포함하고, 공간이 없으면 링크 안내로 축약한다.
 */
export function buildBotAlert(
  kind: 'fail' | 'watchdog',
  detail: string | null,
  digestText: string | null
): string {
  const when = kstClockLabel()
  const head =
    kind === 'fail'
      ? `[봇 알림] 단체방 자동 발송 실패 (${when})`
      : `[봇 알림] 18:00 단체방 발송이 실행되지 않았습니다 (${when}) — PC 전원·로그인·카카오톡 상태 확인`
  const cause = detail ? `\n사유: ${detail}` : ''
  const withDigest = `${head}${cause}\n아래 복사해 단체방에 붙여넣어주세요:\n\n${digestText ?? ''}`
  if (withDigest.length <= KAKAO_TEXT_LIMIT && digestText) return withDigest
  return `${head}${cause}\n오늘의 할 일: ${SITE_URL}`.slice(0, KAKAO_TEXT_LIMIT)
}
```

주의: `kstClockLabel()`을 `buildBotAlert` 내부에서 인자 없이 호출하면 테스트가 시각을 제어할 수 없다 — 테스트의 `18:30` 기대는 `NOW` 고정이 필요하므로 `buildBotAlert`에 `now?: Date` 옵션을 추가하고 `kstClockLabel(now)`로 전달한다. 테스트도 `buildBotAlert('fail', ..., ..., NOW)` 형태로 작성한다(위 Step 1 코드에서 `kstClockLabel` 직접 테스트만 `NOW` 사용, `buildBotAlert` 테스트는 `18:30` 문자열 기대를 제거하고 헤더 키워드만 확인).

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/kakao-bot.test.ts`
  Expected: 6 passed

- [ ] **Step 5: 커밋** — `git commit -m "feat: 봇 경보 헬퍼 — KST 기준일·시각 라벨·200자 경보 텍스트"`

---

### Task 4: 보고 수신 API `/api/kakao-bot/report`

**Files:**
- Create: `sportsday-hub/app/api/kakao-bot/report/route.ts`

**Interfaces:**
- Consumes: `kstTodayDate`(Task 3), `sendMemoViaEnv`(Task 1), `buildKakaoDigest`(`@/lib/kakao-digest`, 기존), Supabase `bot_runs`(Task 2)
- Produces: `POST /api/kakao-bot/report` — body `{ status: 'success'|'fail', detail?: string }`, 응답 `{ recorded: true, alerted: boolean }` / 401 / 500

- [ ] **Step 1: 구현**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildKakaoDigest } from '@/lib/kakao-digest'
import { sendMemoViaEnv } from '@/lib/kakao-memo'
import { kstTodayDate, buildBotAlert } from '@/lib/kakao-bot'

/**
 * PC 스크립트(kakao_group_sender.py)가 종료 전 호출하는 실행 보고 엔드포인트.
 * - success: bot_runs에 기록만 (조용히)
 * - fail: 기록 + 즉시 '나에게 보내기' 경보 발송(수동 폴백용 다이제스트 포함)
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { status?: string; detail?: string }
    if (body.status !== 'success' && body.status !== 'fail') {
      return NextResponse.json({ error: 'status must be success|fail' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error: insertError } = await supabase
      .from('bot_runs')
      .insert({ run_date: kstTodayDate(), status: body.status, detail: body.detail ?? null })
    if (insertError) throw new Error(insertError.message)

    // 실패 보고는 즉시 경보 — 다이제스트를 새로 만들어 수동 폴백 텍스트로 포함
    if (body.status === 'fail') {
      const [{ data: milestones }, { data: handoffs }, { data: teams }] = await Promise.all([
        supabase.from('milestones').select('*').is('deleted_at', null),
        supabase.from('handoffs').select('*').is('deleted_at', null),
        supabase.from('teams').select('*'),
      ])
      const digest = buildKakaoDigest(
        { tasks: milestones ?? [], handoffs: handoffs ?? [], teams: teams ?? [] },
        { style: 'detailed', maxItems: 20, textLimit: 2000 }
      )
      const alert = buildBotAlert('fail', body.detail ?? null, digest.text)
      const result = await sendMemoViaEnv(alert)
      return NextResponse.json({ recorded: true, alerted: result.sent, alertError: result.error ?? null })
    }

    return NextResponse.json({ recorded: true, alerted: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: 게이트** — Run: `npx tsc --noEmit`
  Expected: 에러 0

- [ ] **Step 3: 커밋** — `git commit -m "feat: 봇 실행 보고 API — bot_runs 기록 + 실패 시 즉시 경보 메모"`

---

### Task 5: watchdog 크론 `/api/cron/kakao-bot-watchdog`

**Files:**
- Create: `sportsday-hub/app/api/cron/kakao-bot-watchdog/route.ts`
- Modify: `sportsday-hub/vercel.json`

**Interfaces:**
- Consumes: Task 1~4 산출물 전부
- Produces: `GET /api/cron/kakao-bot-watchdog` — Vercel 크론 `10 9 * * *`(18:10 KST)가 호출. 오늘 bot_runs 없으면 미실행 경보 발송.

- [ ] **Step 1: 구현**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildKakaoDigest } from '@/lib/kakao-digest'
import { sendMemoViaEnv } from '@/lib/kakao-memo'
import { kstTodayDate, buildBotAlert } from '@/lib/kakao-bot'

/**
 * 데드맨 스위치 — 18:10 KST에 오늘 봇 보고(bot_runs)가 없으면 미실행 경보.
 * 서버 측 크론이라 PC가 꺼져 있어도 항상 실행된다.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const { data: runs, error } = await supabase
      .from('bot_runs')
      .select('id')
      .eq('run_date', kstTodayDate())
      .limit(1)
    if (error) throw new Error(error.message)

    if (runs && runs.length > 0) {
      return NextResponse.json({ ok: true, reported: true })
    }

    // 미보고: 경보 발송 (다이제스트 조회에 실패해도 경보는 간다)
    let digestText: string | null = null
    try {
      const [{ data: milestones }, { data: handoffs }, { data: teams }] = await Promise.all([
        supabase.from('milestones').select('*').is('deleted_at', null),
        supabase.from('handoffs').select('*').is('deleted_at', null),
        supabase.from('teams').select('*'),
      ])
      digestText = buildKakaoDigest(
        { tasks: milestones ?? [], handoffs: handoffs ?? [], teams: teams ?? [] },
        { style: 'detailed', maxItems: 20, textLimit: 2000 }
      ).text
    } catch {
      digestText = null
    }

    const result = await sendMemoViaEnv(buildBotAlert('watchdog', null, digestText))
    if (!result.sent && result.error) throw new Error(result.error)
    return NextResponse.json({ ok: true, reported: false, alerted: !result.dryRun })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: vercel.json 크론 추가**

```json
{
  "crons": [
    { "path": "/api/cron/kakao-digest", "schedule": "0 0 * * *" },
    { "path": "/api/cron/kakao-bot-watchdog", "schedule": "10 9 * * *" }
  ]
}
```

- [ ] **Step 3: 게이트 + 커밋** — `npx tsc --noEmit` 통과 후
  `git commit -m "feat: 봇 watchdog 크론 — 18:10 미보고 시 데드맨 경보"`

---

### Task 6: PC 스크립트 고도화 (자동 실행·재시도·보고)

**Files:**
- Modify: `sportsday-hub/scripts/kakao_group_sender.py`

**Interfaces:**
- Consumes: `POST /api/kakao-bot/report`(Task 4) — env `REPORT_URL`(기본 `https://sportsday-hub.vercel.app/api/kakao-bot/report`)
- Produces: 종료 코드 0=성공/1=실패 (기존 유지). 모든 종료 경로에서 서버 보고 시도.

- [ ] **Step 1: 보고·카톡 자동 실행·재시도 추가**

```python
REPORT_URL = os.environ.get("REPORT_URL", "https://sportsday-hub.vercel.app/api/kakao-bot/report")
KAKAO_EXE_CANDIDATES = [
    r"C:\Program Files\Kakao\KakaoTalk\KakaoTalk.exe",
    r"C:\Program Files (x86)\Kakao\KakaoTalk\KakaoTalk.exe",
]
KAKAO_LAUNCH_WAIT_SEC = 15

def report(status, detail=None):
    """실행 결과를 서버에 보고. 보고 자체가 실패해도 로그만 남긴다(주 흐름 방해 않음)."""
    try:
        res = requests.post(REPORT_URL, json={"status": status, "detail": detail},
                            headers={"authorization": f"Bearer {CRON_SECRET}"} if CRON_SECRET else {},
                            timeout=10)
        log.info("보고 완료: status=%s http=%d", status, res.status_code)
    except Exception:
        log.exception("서버 보고 실패 (REPORT_URL=%s)", REPORT_URL)

def ensure_kakao_running():
    if find_window("카카오톡") is not None:
        return
    exe = next((p for p in KAKAO_EXE_CANDIDATES if Path(p).exists()), None)
    if exe is None:
        raise RuntimeError("카카오톡이 실행돼 있지 않고 설치 경로도 찾지 못했습니다.")
    log.info("카카오톡 미실행 — 직접 실행: %s", exe)
    subprocess.Popen([exe])
    deadline = time.time() + KAKAO_LAUNCH_WAIT_SEC
    while time.time() < deadline:
        if find_window("카카오톡") is not None:
            return
        time.sleep(1)
    raise RuntimeError("카카오톡 실행 후 15초 내 창이 나타나지 않습니다(자동로그인 확인 필요).")
```

`import subprocess` 추가. `main()` 교체:

```python
def main():
    log.info("실행 시작: room=%r api=%s secret=%s", ROOM_NAME, API_URL, "설정됨" if CRON_SECRET else "없음(인증 생략)")
    try:
        text = fetch_digest()
    except Exception:
        detail = "다이제스트 조회 실패 (API/네트워크 오류)"
        log.exception(detail)
        report("fail", detail)
        sys.exit(1)
    try:
        ensure_kakao_running()
        room = open_room_with_retry(ROOM_NAME)
        send_message(room, text)
        log.info("발송 완료: room=%r 길이=%d자 | %s", ROOM_NAME, len(text), text.splitlines()[0])
        report("success")
    except Exception as exc:
        detail = f"{type(exc).__name__}: {exc}"
        log.exception("카카오톡 전송 실패 (창/UI 자동화 오류)")
        report("fail", detail)
        sys.exit(1)
```

`open_room_with_retry` — 기존 `open_room`을 감싸 1회 재시도(검색 타이밍 실패 흡수):

```python
def open_room_with_retry(room_name):
    try:
        return open_room(room_name)
    except RuntimeError:
        log.warning("방 열기 1차 실패 — 재시도")
        time.sleep(2)
        return open_room(room_name)
```

- [ ] **Step 2: 문법·fetch 단계 검증** — Run:
  `"C:\Users\0616y\AppData\Local\Programs\Python\Python313\python.exe" -X utf8 -c "import kakao_group_sender as k; print('import OK'); print(k.fetch_digest()[:40])"`
  (scripts/ 디렉터리에서. UI 전송 단계는 실행하지 않는다.)

- [ ] **Step 3: 커밋** — `git commit -m "feat: 전송 스크립트 고도화 — 카톡 자동 실행·방 열기 재시도·서버 보고"`

---

### Task 7: 풀 게이트 + 배포

- [ ] **Step 1: 전체 검증** — Run: `npx tsc --noEmit && npx vitest run && npx next build`
  Expected: 전부 통과 (vitest 153+6 passed)
- [ ] **Step 2: 커밋 잔여분 확인 후 push** — `git push origin main`
- [ ] **Step 3: 배포 완료 대기 + 프로덕션 검증**
  - `curl -H "Authorization: Bearer $CRON_SECRET" https://sportsday-hub.vercel.app/api/cron/kakao-bot-watchdog` → 오늘 보고 없으면 `{alerted: true}` 로그용 응답과 함께 실제 경보가 총괄 카톡에 도착 (이 호출이 곧 watchdog 실동작 테스트)
  - **주의: 이 검증은 사용자 카톡에 실제 테스트 경보 1건을 발송한다 — 실행 전 사용자에게 예고할 것.**

---

### Task 8: 실운영 검증 (당일 자동)

- [ ] **Step 1: 18:00 자동 발송 → `scripts/logs/kakao_sender.log`에서 성공·보고 기록 확인**
- [ ] **Step 2: bot_runs 테이블에 오늘 success 행 확인 (REST select)**
- [ ] **Step 3: 18:10 watchdog이 보고를 보고 조용히 종료했는지 확인** (Vercel 배포 로그 또는 재호출 시 `{reported: true}`)

---

## Self-Review 결과

- 스펙 커버리지: 레이어1(카톡 자동실행·재시도)=T6, 레이어2(실패 즉시 경보)=T3·T4, 레이어3(데드맨)=T2·T5, 레이어4(폴백 텍스트 포함)=T3 `buildBotAlert` — 전 커버. CONSOLELOCK 끄기(레이어1 보안 설정)는 사용자 OS 설정이라 플랜에서 제외(별도 승인 후 수동).
- 타입 일관성: `sendMemoViaEnv`·`kstTodayDate`·`buildBotAlert` 시그니처가 T4·T5 사용처와 일치.
- 200자 제약: `buildBotAlert`이 상한 처리하므로 경보 전송 실패 리스크 없음.
