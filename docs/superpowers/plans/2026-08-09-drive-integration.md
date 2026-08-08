# 구글 드라이브 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구글 드라이브의 팀별 폴더에서 파일 메타데이터를 자동으로 가져와 앱의 팀 워크스페이스에 표시하고, 파일 수정 이력을 앱 내 활동과 통합한 피드로 보여준다.

**Architecture:** 관리자 1회 OAuth 연결 → 서버 사이드에서 Google Drive API로 파일 목록 조회 → Supabase에 캐시 → 팀 워크스페이스 개요 탭에서 활동 피드(파일+체크 통합)로 표시. 토큰은 AES-256-GCM 암호화 저장, 모든 API 호출은 서버 Route Handler에서 실행.

**Tech Stack:** Next.js 16, googleapis, @noble/ciphers (AES-256-GCM), Supabase (service_role + anon), TanStack Query, shadcn/ui (@base-ui/react), sonner

**Spec:** `docs/superpowers/specs/2026-08-09-drive-integration-design.md`

## Global Constraints

- **작업 디렉토리:** `sportsday-hub/` (기존 프로젝트)
- **패키지 매니저:** `npm` (pnpm은 한국어 경로에서 충충돌)
- **서버/클라이언트 분리:** 구글 API 호출은 항상 서버 사이드 (Route Handler), 클라이언트는 캐시된 데이터만 읽음
- **토큰 보안:** `drive_tokens` 테이블은 RLS로 SELECT 차단, 서버에서 service_role 키로만 접근, 암호화는 AES-256-GCM
- **최소 권한 스코프:** `drive.metadata.readonly` (파일 내용 읽지 않음)
- **Vercel Hobby 제약:** Cron 하루 100회 → Cron 대신 "페이지 진입 시 신선도 확인" 방식
- **동기화 주기:** 마지막 동기화가 5분 이상이면 백그라운드 갱신, 1분 이내 중복 방지
- **팀 ID 고정값:** `management` | `content` | `budget` | `exchange` | `timeline`
- **UI 프리미티브:** `@base-ui/react` (Radix 아님) — `render` prop 사용, `onCheckedChange` 등
- **lucide-react `^1.30.0`:** Google Drive 브랜드 아이콘 없음 → 인라인 SVG 사용
- **빈도 잦은 커밋:** 각 스텝 완료 시 커밋

---

## File Structure (Drive 연동 범위)

```
sportsday-hub/
├── app/
│   ├── settings/page.tsx                    # 신규: 관리자 설정 페이지
│   └── api/
│       ├── auth/
│       │   ├── google-connect/route.ts      # 신규: OAuth 시작 리다이렉트
│       │   └── google-callback/route.ts     # 신규: OAuth 콜백 → 토큰 교환
│       └── drive/
│           └── sync/route.ts                # 신규: 동기화 엔드포인트
├── lib/
│   ├── drive/
│   │   ├── client.ts                        # 신규: OAuth 클라이언트 + 토큰 관리
│   │   ├── sync.ts                          # 신규: 동기화 로직 (폴더 순회 + upsert)
│   │   └── crypto.ts                        # 신규: AES-256-GCM 암호화/복호화
│   ├── queries/
│   │   ├── drive-files.ts                   # 신규: 파일 캐시 쿼리
│   │   └── activity-feed.ts                 # 신규: 통합 피드 (audit + drive)
│   ├── queries/
│   │   └── keys.ts                          # 수정: drive 관련 쿼리 키 추가
│   └── types/
│       ├── models.ts                        # 수정: DriveFile, DriveToken 타입
│       └── database.ts                      # 수정: drive 테이블 + RPC 추가
├── components/
│   ├── drive/
│   │   ├── activity-feed.tsx                # 신규: 최근 활동 피드
│   │   ├── file-list.tsx                    # 신규: 파일 전체 목록
│   │   └── drive-icon.tsx                   # 신규: 파일 타입별 아이콘
│   └── settings/
│       └── folder-mapping.tsx               # 신규: 팀 폴더 매핑 UI
└── supabase/migrations/
    └── 0007_drive_integration.sql           # 신규: 테이블 + RLS + audit team_id
```

---

## Task 1: DB 마이그레이션 — drive 테이블 + audit_log 확장

**Files:**
- Create: `sportsday-hub/supabase/migrations/0007_drive_integration.sql`

**Interfaces:**
- Consumes: 기존 스키마 (0001~0006)
- Produces: `drive_tokens`, `drive_files` 테이블, `teams.drive_folder_id` 컬럼, `audit_log.team_id` 컬럼, RLS 정책. Task 2의 타입 정의가 이 스키마에 대응.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/0007_drive_integration.sql` 생성:

```sql
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
```

- [ ] **Step 2: 클라우드 DB에 적용**

```bash
cd sportsday-hub
echo "y" | npx supabase db push
```

- [ ] **Step 3: 적용 확인**

Supabase 대시보드 Table Editor에서:
- `drive_tokens`, `drive_files` 테이블 생성 확인
- `teams`에 `drive_folder_id` 컬럼 확인
- `audit_log`에 `team_id` 컬럼 확인

- [ ] **Step 4: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 드라이브 연동 DB 마이그레이션 (Task 1)"
```

---

## Task 2: 타입 정의 + 의존성 설치

**Files:**
- Modify: `sportsday-hub/lib/types/models.ts`
- Modify: `sportsday-hub/lib/types/database.ts`
- Modify: `sportsday-hub/package.json` (의존성 추가)

**Interfaces:**
- Consumes: Task 1의 스키마
- Produces: `DriveToken`, `DriveFile` 타입, `ActivityFeedItem` 타입. `Database` 타입에 drive 테이블 추가. 이후 모든 Task가 이 타입 사용.

- [ ] **Step 1: 의존성 설치**

```bash
cd sportsday-hub
npm install googleapis @noble/ciphers
```

- [ ] **Step 2: models.ts에 Drive 타입 추가**

`lib/types/models.ts` 파일 끝에 추가:

```typescript
// ===== 구글 드라이브 연동 =====
export const driveTokenSchema = z.object({
  id: z.number(),
  email: z.string().nullable(),
  access_token: z.string().nullable(),
  refresh_token: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})
export type DriveToken = z.infer<typeof driveTokenSchema>

export const driveFileSchema = z.object({
  id: z.string().uuid(),
  team_id: z.enum(TEAM_IDS),
  file_id: z.string(),
  name: z.string(),
  mime_type: z.string().nullable(),
  icon_link: z.string().nullable(),
  modified_time: z.string().nullable(),
  modified_by: z.string().nullable(),
  web_view_link: z.string().nullable(),
  last_synced: z.string().optional(),
})
export type DriveFile = z.infer<typeof driveFileSchema>

// ===== 통합 활동 피드 =====
export type ActivityFeedItem = {
  id: string
  type: 'file' | 'checklist' | 'decision' | 'issue'
  title: string
  timestamp: string
  actor: string
  link?: string
  icon?: string
  mimeType?: string
}
```

- [ ] **Step 3: teamSchema에 drive_folder_id 추가**

`lib/types/models.ts`의 `teamSchema`에서 `deleted_at` 뒤에 추가:

```typescript
  deleted_at: z.string().nullable().optional(),
  drive_folder_id: z.string().nullable().optional(),
```

- [ ] **Step 4: database.ts에 drive 테이블 추가**

`lib/types/database.ts` 수정 — import에 `DriveToken, DriveFile` 추가, Tables에 2개 항목 추가:

```typescript
import type {
  Team,
  Decision,
  Milestone,
  ChecklistItem,
  Issue,
  AuditLog,
  DriveToken,
  DriveFile,
} from './models'

export interface Database {
  public: {
    Tables: {
      teams: { Row: Team; Insert: Partial<Team>; Update: Partial<Team>; Relationships: [] }
      decisions: { Row: Decision; Insert: Partial<Decision>; Update: Partial<Decision>; Relationships: [] }
      milestones: { Row: Milestone; Insert: Partial<Milestone>; Update: Partial<Milestone>; Relationships: [] }
      checklist_items: { Row: ChecklistItem; Insert: Partial<ChecklistItem>; Update: Partial<ChecklistItem>; Relationships: [] }
      issues: { Row: Issue; Insert: Partial<Issue>; Update: Partial<Issue>; Relationships: [] }
      audit_log: { Row: AuditLog; Insert: Omit<AuditLog, 'id' | 'created_at'>; Update: Partial<AuditLog>; Relationships: [] }
      drive_tokens: { Row: DriveToken; Insert: Partial<DriveToken>; Update: Partial<DriveToken>; Relationships: [] }
      drive_files: { Row: DriveFile; Insert: Omit<DriveFile, 'id' | 'last_synced'>; Update: Partial<DriveFile>; Relationships: [] }
    }
    Views: {}
    Functions: {
      set_user_context: { Args: { p_nickname: string }; Returns: undefined }
      update_guideline_section: { Args: { p_team_id: string; p_section_id: string; p_content_md: string }; Returns: undefined }
    }
  }
}
```

- [ ] **Step 5: 타입 체크**

```bash
cd sportsday-hub
npx tsc --noEmit
```

- [ ] **Step 6: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: Drive 타입 정의 + 의존성 설치 (Task 2)"
```

---

## Task 3: 암호화 모듈 + OAuth 클라이언트

**Files:**
- Create: `sportsday-hub/lib/drive/crypto.ts`
- Create: `sportsday-hub/lib/drive/client.ts`

**Interfaces:**
- Consumes: `@noble/ciphers`, `googleapis`, 환경 변수 `DRIVE_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- Produces: `encryptToken(plaintext)`, `decryptToken(ciphertext)`, `getDriveTokens()`, `saveDriveTokens(tokens)`, `createDriveClient(tokens)` — Task 4의 sync가 사용.

- [ ] **Step 1: 암호화 모듈**

`lib/drive/crypto.ts` 생성:

```typescript
import { gcm } from '@noble/ciphers/aes'
import { randomBytes } from 'crypto'

const getKey = (): Uint8Array => {
  const keyHex = process.env.DRIVE_ENCRYPTION_KEY
  if (!keyHex) throw new Error('DRIVE_ENCRYPTION_KEY not set')
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) throw new Error('DRIVE_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return key
}

export function encryptToken(plaintext: string): string {
  const key = getKey()
  const nonce = randomBytes(12)
  const cipher = gcm(key, nonce)
  const ciphertext = cipher.encrypt(Buffer.from(plaintext))
  // nonce + ciphertext를 base64로 결합
  return Buffer.concat([nonce, ciphertext]).toString('base64')
}

export function decryptToken(combined: string): string {
  const key = getKey()
  const data = Buffer.from(combined, 'base64')
  const nonce = data.subarray(0, 12)
  const ciphertext = data.subarray(12)
  const cipher = gcm(key, nonce)
  const plaintext = cipher.decrypt(ciphertext)
  return Buffer.from(plaintext).toString()
}
```

- [ ] **Step 2: 환경 변수 템플릿 업데이트**

`.env.local.example`에 추가:

```bash
# Google Drive Integration (서버 전용)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
DRIVE_ENCRYPTION_KEY=generate-64-hex-chars-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/auth/google-callback
```

- [ ] **Step 3: OAuth 클라이언트 + 토큰 관리**

`lib/drive/client.ts` 생성:

```typescript
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { encryptToken, decryptToken } from './crypto'
import type { DriveToken } from '@/lib/types/models'
import type { Database } from '@/lib/types/database'

// service_role 클라이언트 (RLS 우회, 서버 전용)
function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// 토큰 조회 (복호화)
export async function getDriveTokens(): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date | null
  email: string | null
} | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('drive_tokens')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (!data || !data.access_token || !data.refresh_token) return null

  return {
    accessToken: decryptToken(data.access_token),
    refreshToken: decryptToken(data.refresh_token),
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    email: data.email,
  }
}

// 토큰 저장 (암호화)
export async function saveDriveTokens(params: {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  email: string
}): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('drive_tokens').upsert({
    id: 1,
    email: params.email,
    access_token: encryptToken(params.accessToken),
    refresh_token: encryptToken(params.refreshToken),
    expires_at: params.expiresAt.toISOString(),
  })
}

// 토큰 삭제
export async function clearDriveTokens(): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('drive_tokens').delete().eq('id', 1)
}

// 토큰으로 Google Drive 클라이언트 생성 (만료 시 자동 갱신)
export async function createDriveClient(): Promise<{
  drive: ReturnType<typeof google.drive>
  email: string | null
} | null> {
  const tokens = await getDriveTokens()
  if (!tokens) return null

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  )

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiresAt?.getTime(),
  })

  // 만료 시 자동 갱신 이벤트 처리
  oauth2Client.on('tokens', async (newTokens) => {
    if (newTokens.refresh_token) {
      // 새 refresh_token이 오면 저장
      const accessToken = newTokens.access_token ?? tokens.accessToken
      const refreshToken = newTokens.refresh_token ?? tokens.refreshToken
      const expiresAt = newTokens.expiry_date
        ? new Date(newTokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000)
      await saveDriveTokens({
        accessToken,
        refreshToken,
        expiresAt,
        email: tokens.email ?? '',
      })
    }
  })

  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  return { drive, email: tokens.email }
}

// OAuth 인증 URL 생성
export function getAuthUrl(): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  )

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
    prompt: 'consent', // refresh_token을 받기 위해 강제 동의
  })
}

// 인증 코드를 토큰으로 교환
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  )

  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}
```

- [ ] **Step 4: 타입 체크**

```bash
cd sportsday-hub
npx tsc --noEmit
```

> 주의: `createServiceClient`에서 `Database` 타입 import가 함수 뒤에 있을 수 있음. 컴파일 에러 나면 import 순서 조정.

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 암호화 모듈 + OAuth 클라이언트 (Task 3)"
```

---

## Task 4: 동기화 로직

**Files:**
- Create: `sportsday-hub/lib/drive/sync.ts`

**Interfaces:**
- Consumes: `createDriveClient()` from Task 3, `teams` 테이블의 `drive_folder_id`
- Produces: `syncDriveFiles(teamId?, force?)` — 주어진 팀(또는 전체)의 파일 목록을 구글에서 가져와 `drive_files`에 upsert. Task 6의 API 라우트가 호출.

- [ ] **Step 1: 동기화 로직 작성**

`lib/drive/sync.ts` 생성:

```typescript
import { createDriveClient, clearDriveTokens } from './client'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { TeamId } from '@/lib/types/models'

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface DriveFileMeta {
  id: string
  name: string
  mimeType: string
  iconLink?: string
  modifiedTime?: string
  lastModifyingUser?: { displayName?: string }
  webViewLink?: string
}

// 단일 팀 폴더 동기화
async function syncTeamFolder(
  drive: ReturnType<typeof import('googleapis').google.drive>,
  teamId: TeamId,
  folderId: string
): Promise<number> {
  const supabase = createServiceClient()

  // 폴더 내 파일 목록 조회
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,iconLink,modifiedTime,lastModifyingUser/displayName,webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  })

  const files = (res.data.files ?? []) as DriveFileMeta[]
  const fileIds = files.map((f) => f.id)

  // 삭제된 파일 제거 (구글에 없는 파일)
  if (fileIds.length > 0) {
    await supabase
      .from('drive_files')
      .delete()
      .eq('team_id', teamId)
      .not('file_id', 'in', `(${fileIds.map((id) => `'${id}'`).join(',')})`)
  } else {
    // 폴더가 비었으면 전체 삭제
    await supabase.from('drive_files').delete().eq('team_id', teamId)
  }

  // 파일 upsert
  const now = new Date().toISOString()
  for (const file of files) {
    await supabase.from('drive_files').upsert(
      {
        team_id: teamId,
        file_id: file.id,
        name: file.name,
        mime_type: file.mimeType ?? null,
        icon_link: file.iconLink ?? null,
        modified_time: file.modifiedTime ?? null,
        modified_by: file.lastModifyingUser?.displayName ?? null,
        web_view_link: file.webViewLink ?? null,
        last_synced: now,
      },
      { onConflict: 'file_id' }
    )
  }

  return files.length
}

// 전체 또는 단일 팀 동기화
export async function syncDriveFiles(
  teamId?: TeamId,
  force = false
): Promise<{ success: boolean; syncedTeams: number; totalFiles: number; error?: string }> {
  const supabase = createServiceClient()

  // 중복 방지: 1분 이내 동기화 스킵 (force가 아니면)
  if (!force) {
    const { data: recent } = await supabase
      .from('drive_files')
      .select('last_synced')
      .order('last_synced', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent?.last_synced) {
      const elapsed = Date.now() - new Date(recent.last_synced).getTime()
      if (elapsed < 60_000) {
        return { success: true, syncedTeams: 0, totalFiles: 0 }
      }
    }
  }

  // 드라이브 클라이언트 생성
  const client = await createDriveClient()
  if (!client) {
    return { success: false, syncedTeams: 0, totalFiles: 0, error: 'not_connected' }
  }

  // 동기화할 팀 목록
  let teamsQuery = supabase.from('teams').select('id, drive_folder_id').not('drive_folder_id', 'is', null)
  if (teamId) {
    teamsQuery = teamsQuery.eq('id', teamId)
  }
  const { data: teams } = await teamsQuery

  if (!teams || teams.length === 0) {
    return { success: true, syncedTeams: 0, totalFiles: 0 }
  }

  let totalFiles = 0
  let syncedTeams = 0

  for (const team of teams) {
    try {
      const count = await syncTeamFolder(client.drive, team.id as TeamId, team.drive_folder_id!)
      totalFiles += count
      syncedTeams++
    } catch (err) {
      console.error(`Failed to sync team ${team.id}:`, err)
    }
  }

  return { success: true, syncedTeams, totalFiles }
}

// 연결 상태 확인
export async function getDriveConnectionStatus(): Promise<{
  connected: boolean
  email: string | null
}> {
  const client = await createDriveClient()
  if (!client) return { connected: false, email: null }
  return { connected: true, email: client.email }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd sportsday-hub
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 드라이브 동기화 로직 (Task 4)"
```

---

## Task 5: OAuth Route Handlers

**Files:**
- Create: `sportsday-hub/app/api/auth/google-connect/route.ts`
- Create: `sportsday-hub/app/api/auth/google-callback/route.ts`
- Create: `sportsday-hub/app/api/drive/sync/route.ts`

**Interfaces:**
- Consumes: `getAuthUrl()`, `exchangeCodeForTokens()`, `saveDriveTokens()` from Task 3, `syncDriveFiles()` from Task 4
- Produces: 3개 API 엔드포인트. Task 6, 7의 UI가 호출.

- [ ] **Step 1: OAuth 시작 라우트**

`app/api/auth/google-connect/route.ts` 생성:

```typescript
import { NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/drive/client'

export async function GET() {
  try {
    const url = getAuthUrl()
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('OAuth connect error:', error)
    return NextResponse.redirect(
      new URL('/settings?error=oauth_failed', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000')
    )
  }
}
```

- [ ] **Step 2: OAuth 콜백 라우트**

`app/api/auth/google-callback/route.ts` 생성:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, saveDriveTokens } from '@/lib/drive/client'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  if (error || !code) {
    return NextResponse.redirect(new URL('/settings?error=oauth_denied', baseUrl))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/settings?error=no_refresh_token', baseUrl))
    }

    // 이메일 조회
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URL
    )
    oauth2Client.setCredentials(tokens)
    const userInfo = await oauth2Client.getTokenInfo(tokens.access_token)
    const email = userInfo.email ?? 'unknown'

    await saveDriveTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000),
      email,
    })

    return NextResponse.redirect(new URL('/settings?connected=true', baseUrl))
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?error=callback_failed', baseUrl))
  }
}
```

- [ ] **Step 3: 동기화 라우트**

`app/api/drive/sync/route.ts` 생성:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { syncDriveFiles } from '@/lib/drive/sync'
import type { TeamId } from '@/lib/types/models'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const teamId = body.teamId as TeamId | undefined
    const force = body.force === true

    const result = await syncDriveFiles(teamId, force)

    if (!result.success && result.error === 'not_connected') {
      return NextResponse.json({ error: 'drive_not_connected' }, { status: 401 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: 타입 체크**

```bash
cd sportsday-hub
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: OAuth + 동기화 Route Handlers (Task 5)"
```

---

## Task 6: 쿼리 + 활동 피드 로직

**Files:**
- Create: `sportsday-hub/lib/queries/drive-files.ts`
- Create: `sportsday-hub/lib/queries/activity-feed.ts`
- Modify: `sportsday-hub/lib/queries/keys.ts`

**Interfaces:**
- Consumes: Task 2의 타입, 기존 `audit_log` + 새 `drive_files` 테이블
- Produces: `getDriveFiles(teamId)`, `getDriveFilesByTeam(teamId)`, `getActivityFeed(teamId)`, `getDriveConnectionStatus()`. Task 7, 8의 컴포넌트가 사용.

- [ ] **Step 1: 쿼리 키 추가**

`lib/queries/keys.ts`의 `queryKeys` 객체에 추가:

```typescript
  auditForRecord: (table: string, recordId: string) =>
    ['audit-log', table, recordId] as const,
  driveFiles: ['drive-files'] as const,
  driveFilesByTeam: (teamId: string) => ['drive-files', 'team', teamId] as const,
  activityFeed: (teamId: string) => ['activity-feed', teamId] as const,
  driveStatus: ['drive-status'] as const,
}
```

- [ ] **Step 2: drive-files 쿼리**

`lib/queries/drive-files.ts` 생성:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { DriveFile, TeamId } from '@/lib/types/models'

export async function getDriveFilesByTeam(teamId: TeamId): Promise<DriveFile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drive_files')
    .select('*')
    .eq('team_id', teamId)
    .order('modified_time', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function getDriveFileCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('drive_files')
    .select('*', { count: 'exact', head: true })
  return count ?? 0
}
```

- [ ] **Step 3: 활동 피드 쿼리**

`lib/queries/activity-feed.ts` 생성:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { TeamId, ActivityFeedItem } from '@/lib/types/models'

export async function getActivityFeed(
  teamId: TeamId,
  limit = 8
): Promise<ActivityFeedItem[]> {
  const supabase = await createClient()

  // 드라이브 파일 (최근 수정)
  const { data: files } = await supabase
    .from('drive_files')
    .select('*')
    .eq('team_id', teamId)
    .order('modified_time', { ascending: false, nullsFirst: false })
    .limit(limit)

  // 감사 로그 (해당 팀 관련)
  const { data: logs } = await supabase
    .from('audit_log')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(limit)

  // 두 소스를 ActivityFeedItem으로 변환 + 시간순 병합
  const fileItems: ActivityFeedItem[] = (files ?? []).map((f) => ({
    id: `file-${f.file_id}`,
    type: 'file' as const,
    title: f.name,
    timestamp: f.modified_time ?? f.last_synced ?? new Date().toISOString(),
    actor: f.modified_by ?? '알 수 없음',
    link: f.web_view_link ?? undefined,
    mimeType: f.mime_type ?? undefined,
  }))

  const logItems: ActivityFeedItem[] = (logs ?? []).map((l) => ({
    id: `log-${l.id}`,
    type: l.table_name === 'decisions' ? 'decision' : l.table_name === 'issues' ? 'issue' : 'checklist',
    title: extractTitle(l),
    timestamp: l.created_at ?? new Date().toISOString(),
    actor: l.changed_by,
  }))

  const merged = [...fileItems, ...logItems]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)

  return merged
}

function extractTitle(log: {
  table_name: string
  new_value: unknown
  old_value: unknown
  action: string
}): string {
  const newValue = log.new_value as Record<string, unknown> | null
  if (newValue) {
    if (typeof newValue.content === 'string') return newValue.content.slice(0, 60)
    if (typeof newValue.title === 'string') return newValue.title.slice(0, 60)
    if (typeof newValue.current_value === 'string') return newValue.current_value.slice(0, 60)
  }
  return `${log.table_name} ${log.action}`
}
```

- [ ] **Step 4: 타입 체크**

```bash
cd sportsday-hub
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 드라이브 파일 + 활동 피드 쿼리 (Task 6)"
```

---

## Task 7: 드라이브 UI 컴포넌트

**Files:**
- Create: `sportsday-hub/components/drive/drive-icon.tsx`
- Create: `sportsday-hub/components/drive/file-list.tsx`
- Create: `sportsday-hub/components/drive/activity-feed.tsx`

**Interfaces:**
- Consumes: Task 6의 쿼리, Task 2의 `DriveFile`/`ActivityFeedItem` 타입
- Produces: `FileList`, `ActivityFeed`, `DriveFileIcon` 컴포넌트. Task 8의 team-tabs와 settings가 사용.

- [ ] **Step 1: 파일 타입별 아이콘 컴포넌트**

`components/drive/drive-icon.tsx` 생성:

```tsx
import { FileSpreadsheet, FileText, Presentation, File, FileType } from 'lucide-react'

const ICON_MAP: Record<string, typeof File> = {
  'application/vnd.google-apps.spreadsheet': FileSpreadsheet,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'application/vnd.ms-excel': FileSpreadsheet,
  'application/vnd.google-apps.document': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/msword': FileText,
  'application/vnd.google-apps.presentation': Presentation,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': Presentation,
  'application/vnd.ms-powerpoint': Presentation,
  'application/pdf': FileType,
}

export function DriveFileIcon({ mimeType, className }: { mimeType?: string | null; className?: string }) {
  const Icon = (mimeType && ICON_MAP[mimeType]) || File
  return <Icon className={className ?? 'h-4 w-4'} />
}
```

- [ ] **Step 2: 파일 목록 컴포넌트**

`components/drive/file-list.tsx` 생성:

```tsx
import { ExternalLink } from 'lucide-react'
import { DriveFileIcon } from './drive-icon'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { EmptyState } from '@/components/shared/empty-state'
import type { DriveFile } from '@/lib/types/models'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 7) return `${days}일 전`
  return format(parseISO(dateStr), 'M월 d일', { locale: ko })
}

export function FileList({ files }: { files: DriveFile[] }) {
  if (files.length === 0) {
    return <EmptyState title="파일이 없습니다" description="구글 드라이브 폴더에 파일이 없거나 아직 동기화되지 않았습니다." />
  }

  return (
    <div className="space-y-1">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
        >
          <DriveFileIcon mimeType={file.mime_type} className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{file.name}</div>
            <div className="text-xs text-muted-foreground">
              {file.modified_time && `${timeAgo(file.modified_time)} · `}
              {file.modified_by ?? '알 수 없음'}
            </div>
          </div>
          {file.web_view_link && (
            <a
              href={file.web_view_link}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md p-2 hover:bg-muted transition-colors"
              title="드라이브에서 열기"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 활동 피드 컴포넌트**

`components/drive/activity-feed.tsx` 생성:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, ChevronRight, CheckCircle2, FileText, GitBranch, AlertCircle } from 'lucide-react'
import { DriveFileIcon } from './drive-icon'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { ActivityFeedItem, TeamId } from '@/lib/types/models'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 7) return `${days}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

function ActivityIcon({ item }: { item: ActivityFeedItem }) {
  if (item.type === 'file') {
    return <DriveFileIcon mimeType={item.mimeType} className="h-4 w-4 shrink-0 text-blue-500" />
  }
  if (item.type === 'checklist') return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
  if (item.type === 'decision') return <GitBranch className="h-4 w-4 shrink-0 text-purple-500" />
  return <AlertCircle className="h-4 w-4 shrink-0 text-orange-500" />
}

export function ActivityFeed({
  items,
  teamId,
}: {
  items: ActivityFeedItem[]
  teamId: TeamId
}) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/drive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, force: true }),
      })
      if (res.status === 401) {
        toast.error('드라이브 연결이 필요합니다. 기획관리팀에 문의해주세요.')
        return
      }
      if (!res.ok) throw new Error()
      toast.success('최신 상태로 동기화되었습니다.')
      router.refresh()
    } catch {
      toast.error('동기화 실패. 잠시 후 다시 시도해주세요.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">📌 최근 활동</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSync}
          disabled={syncing}
          className="text-muted-foreground"
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '동기화 중...' : '새로고침'}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          최근 활동이 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <ActivityIcon item={item} />
              <div className="min-w-0 flex-1">
                <span className="truncate">{item.title}</span>
                {item.actor && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {timeAgo(item.timestamp)} · {item.actor}
                  </span>
                )}
              </div>
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md p-1 hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 타입 체크**

```bash
cd sportsday-hub
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 드라이브 UI 컴포넌트 (아이콘/목록/피드) (Task 7)"
```

---

## Task 8: 팀 워크스페이스 개요에 활동 피드 통합

**Files:**
- Modify: `sportsday-hub/components/team/team-tabs.tsx`
- Modify: `sportsday-hub/app/team/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 7의 `ActivityFeed`, Task 6의 `getActivityFeed()`, `getDriveFilesByTeam()`
- Produces: 팀 페이지 개요 탭에 활동 피드 + 드라이브 파일 섹션 표시.

- [ ] **Step 1: 팀 페이지에서 데이터 fetch 추가**

`app/team/[id]/page.tsx` 수정 — 기존 Promise.all에 `getActivityFeed`와 `getDriveFilesByTeam` 추가. Read the file first, then add the imports and queries.

```typescript
import { getActivityFeed } from '@/lib/queries/activity-feed'
import { getDriveFilesByTeam } from '@/lib/queries/drive-files'
// ... 기존 imports ...

// Promise.all에 추가:
const [checklist, milestones, issues, activityFeed, driveFiles] = await Promise.all([
  getChecklistByTeam(id as (typeof TEAM_IDS)[number]),
  getMilestonesByTeam(id as (typeof TEAM_IDS)[number]),
  getIssuesByTeam(id as (typeof TEAM_IDS)[number]),
  getActivityFeed(id as (typeof TEAM_IDS)[number], 8),
  getDriveFilesByTeam(id as (typeof TEAM_IDS)[number]),
])
```

그리고 `<TeamTabs>`에 props 추가:

```tsx
<TeamTabs
  team={team}
  checklist={checklist}
  milestones={milestones}
  issues={issues}
  activityFeed={activityFeed}
  driveFiles={driveFiles}
/>
```

- [ ] **Step 2: team-tabs.tsx에 활동 피드 + 파일 섹션 추가**

`components/team/team-tabs.tsx` 수정 — props에 `activityFeed`와 `driveFiles` 추가, 개요 탭에 통합:

```tsx
import { ActivityFeed } from '@/components/drive/activity-feed'
import { FileList } from '@/components/drive/file-list'
import type { ActivityFeedItem, DriveFile } from '@/lib/types/models'

// 컴포넌트 시그니처에 추가:
export function TeamTabs({
  team,
  checklist,
  milestones,
  issues,
  activityFeed,
  driveFiles,
}: {
  team: Team
  checklist: ChecklistItem[]
  milestones: Milestone[]
  issues: Issue[]
  activityFeed: ActivityFeedItem[]
  driveFiles: DriveFile[]
}) {
  // ... 기존 코드 ...

  // 개요 탭 내용에 추가 (기존 미션/진행률 뒤):
  <TabsContent value="overview" className="mt-4 space-y-4">
    {/* 기존 미션 카드 */}
    {/* 기존 진행률 카드 */}

    <ActivityFeed items={activityFeed} teamId={team.id} />

    {driveFiles.length > 0 && (
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            📁 드라이브 파일 ({driveFiles.length})
          </h3>
        </div>
        <FileList files={driveFiles.slice(0, 5)} />
        {driveFiles.length > 5 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            최근 5개 파일 표시 중
          </p>
        )}
      </div>
    )}
  </TabsContent>
```

- [ ] **Step 3: 타입 체크 + 빌드**

```bash
cd sportsday-hub
npx tsc --noEmit && npm run build
```

- [ ] **Step 4: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 팀 개요에 활동 피드 + 드라이브 파일 통합 (Task 8)"
```

---

## Task 9: 설정 페이지 — 드라이브 연결 + 폴더 매핑

**Files:**
- Create: `sportsday-hub/app/settings/page.tsx`
- Create: `sportsday-hub/components/settings/folder-mapping.tsx`
- Modify: `sportsday-hub/components/layout/app-sidebar.tsx` (설정 링크 추가)

**Interfaces:**
- Consumes: Task 5의 OAuth 라우트, Task 4의 `getDriveConnectionStatus()`, teams 테이블의 `drive_folder_id`
- Produces: `/settings` 페이지에서 관리자가 드라이브 연결 + 폴더 매핑.

- [ ] **Step 1: 설정 페이지 생성**

`app/settings/page.tsx` 생성:

```tsx
import { FolderMapping } from '@/components/settings/folder-mapping'
import { getDriveConnectionStatus } from '@/lib/drive/sync'
import { getTeams } from '@/lib/queries/teams'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [status, teams] = await Promise.all([
    getDriveConnectionStatus(),
    getTeams(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">⚙️ 설정</h1>
        <p className="text-sm text-muted-foreground">
          구글 드라이브 연동 관리
        </p>
      </div>

      {/* 연결 상태 */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-2 text-lg font-semibold">📁 구글 드라이브 연결</h2>
        {status.connected ? (
          <div className="space-y-2">
            <p className="text-sm text-green-600">
              ✓ 연결됨: {status.email}
            </p>
            <a
              href="/api/auth/google-connect"
              className="inline-block rounded-md border px-3 py-1 text-sm hover:bg-muted"
            >
              다른 계정으로 재연결
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              구글 드라이브가 연결되지 않았습니다.
            </p>
            <a
              href="/api/auth/google-connect"
              className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              구글 드라이브 연결하기
            </a>
          </div>
        )}
      </div>

      {/* 폴더 매핑 */}
      {status.connected && (
        <FolderMapping teams={teams} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 폴더 매핑 컴포넌트**

`components/settings/folder-mapping.tsx` 생성:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Team } from '@/lib/types/models'

function extractFolderId(url: string): string | null {
  // drive.google.com/drive/folders/XXXX 형식에서 ID 추출
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export function FolderMapping({ teams }: { teams: Team[] }) {
  const router = useRouter()
  const [folderUrls, setFolderUrls] = useState<Record<string, string>>(
    Object.fromEntries(
      teams.map((t) => [t.id, t.drive_folder_id ? `https://drive.google.com/drive/folders/${t.drive_folder_id}` : ''])
    )
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      // 각 팀의 폴더 ID 추출 후 DB 업데이트
      const updates = teams.map((team) => {
        const url = folderUrls[team.id] ?? ''
        const folderId = url.trim() ? extractFolderId(url) : null
        return { id: team.id, drive_folder_id: folderId }
      })

      // API 호출 (Route Handler 또는 직접 Supabase)
      const res = await fetch('/api/drive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_folders', updates }),
      })

      if (!res.ok) throw new Error()
      toast.success('폴더 매핑이 저장되었습니다.')
      router.refresh()
    } catch {
      toast.error('저장 실패. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-2 text-lg font-semibold">📂 팀 폴더 매핑</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        각 팀의 구글 드라이브 폴더 URL을 입력하세요.
      </p>
      <div className="space-y-3">
        {teams.map((team) => (
          <div key={team.id} className="flex items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: team.color }}
            />
            <span className="w-24 shrink-0 text-sm font-medium">{team.name}</span>
            <Input
              placeholder="https://drive.google.com/drive/folders/..."
              value={folderUrls[team.id] ?? ''}
              onChange={(e) =>
                setFolderUrls((prev) => ({ ...prev, [team.id]: e.target.value }))
              }
              className="h-9"
            />
          </div>
        ))}
      </div>
      <Button onClick={handleSave} disabled={saving} className="mt-4">
        {saving ? '저장 중...' : '저장하고 동기화'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: 폴더 매핑 저장 API 추가**

`app/api/drive/sync/route.ts`에 PATCH 또는 action 분기 추가. 기존 POST 핸들러에 action 체크 추가:

```typescript
// POST 핸들러 시작 부분에 추가:
const body = await request.json().catch(() => ({}))

// 폴더 매핑 저장 액션
if (body.action === 'save_folders' && body.updates) {
  const supabase = createServiceClient()
  for (const update of body.updates) {
    await supabase
      .from('teams')
      .update({ drive_folder_id: update.drive_folder_id })
      .eq('id', update.id)
  }
  // 저장 후 즉시 동기화
  const result = await syncDriveFiles(undefined, true)
  return NextResponse.json({ saved: true, ...result })
}
```

`createServiceClient`는 `lib/drive/sync.ts`에서 export하거나 import 필요. sync.ts의 함수를 export하거나 route.ts에서 직접 생성.

- [ ] **Step 4: 사이드바에 설정 링크 추가**

`components/layout/app-sidebar.tsx` 수정 — `NAV_ITEMS`에 추가:

```typescript
import { Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/timeline', label: '타임라인', icon: CalendarClock },
  { href: '/checklists', label: '체크리스트', icon: CheckSquare },
  { href: '/trash', label: '휴지통', icon: Trash2 },
  { href: '/settings', label: '설정', icon: Settings },
]
```

- [ ] **Step 5: 타입 체크 + 빌드**

```bash
cd sportsday-hub
npx tsc --noEmit && npm run build
```

- [ ] **Step 6: 커밋**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 설정 페이지 — 드라이브 연결 + 폴더 매핑 (Task 9)"
```

---

## Task 10: 클라우드 DB 적용 + .env 설정 + 최종 빌드

**Files:**
- Apply: `supabase/migrations/0007_drive_integration.sql` to cloud DB
- Modify: `.env.local` (환경 변수 추가)
- Modify: Vercel 환경 변수 (사용자 수동)

**Interfaces:**
- Consumes: 모든 이전 Task
- Produces: 프로덕션에 드라이브 연동 기능 활성화.

- [ ] **Step 1: 마이그레이션 클라우드 적용**

Task 1에서 이미 적용했으면 스킵. 안 했으면:

```bash
cd sportsday-hub
echo "y" | npx supabase db push
```

- [ ] **Step 2: 암호화 키 생성**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

출력된 64자 hex 문자열을 `.env.local`에 `DRIVE_ENCRYPTION_KEY`로 저장.

- [ ] **Step 3: .env.local에 환경 변수 추가**

```bash
# Google Drive Integration
GOOGLE_CLIENT_ID=<구글 클라우드 콘솔에서 복사>
GOOGLE_CLIENT_SECRET=<구글 클라우드 콘솔에서 복사>
DRIVE_ENCRYPTION_KEY=<Step 2에서 생성한 64자 hex>
SUPABASE_SERVICE_ROLE_KEY=<Supabase 대시보드 → Settings → API → service_role>
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/auth/google-callback
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

- [ ] **Step 4: 최종 빌드 확인**

```bash
cd sportsday-hub
npm run build
```

- [ ] **Step 5: 커밋 + 푸시**

```bash
cd "C:\Users\0616y\Downloads\26-2 스포츠데이기획"
git add -A
git commit -m "feat: 드라이브 연동 환경 설정 + 최종 빌드 (Task 10)"
git push origin main
```

- [ ] **Step 6: Vercel 환경 변수 설정 (사용자 수동)**

Vercel 대시보드 → Settings → Environment Variables에 추가:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `DRIVE_ENCRYPTION_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_OAUTH_REDIRECT_URL` = `https://sportsday-hub.vercel.app/api/auth/google-callback`
- `NEXT_PUBLIC_BASE_URL` = `https://sportsday-hub.vercel.app`

- [ ] **Step 7: 구글 클라우드 콘솔 설정 (사용자 수동)**

1. [console.cloud.google.com](https://console.cloud.google.com) → 프로젝트 생성
2. Google Drive API 활성화
3. OAuth 동의 화면 (External, 스코프: `drive.metadata.readonly`)
4. OAuth 클라이언트 ID 생성 (Web, 리다이렉트 URI에 Vercel URL 추가)
5. Client ID + Secret을 Vercel 환경 변수에 입력

---

## Drive 연동 완료 기준

- [ ] `/settings`에서 "구글 드라이브 연결하기" → OAuth → "✓ 연결됨"
- [ ] 팀 폴더 URL 입력 → "저장하고 동기화" → 파일 목록 표시
- [ ] 팀 페이지 개요 탭에 최근 활동 피드 (파일 수정 + 체크 완료 통합)
- [ ] "🔄 새로고침" 버튼으로 수동 동기화
- [ ] 파일 클릭 시 구글 드라이브에서 열림
- [ ] 미연결 시 부드러운 안내 메시지
- [ ] Vercel 배포 후 프로덕션에서 작동
