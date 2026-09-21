# 구글 드라이브 연동 — 설계 문서

**작성일**: 2026-08-09
**대상**: 26-2 스포츠데이 허브에 구글 드라이브 파일 미러링 추가
**상태**: 승인됨 (설계 단계 완료)

---

## 0. 배경

팀이 구글 드라이브(공유 드라이브)에서 각자 파일을 수정하며 협업 중이다. 폴더는 팀별로 나뉘어 있다. 현재 앱은 진행상황(결정/체크리스트/마일스톤)을 관리하지만, 드라이브의 파일과 분리되어 있다.

**대전제:** 사용자(하클 팀원)는 AI나 기술적 요소를 모르는 일반인이다. "앱 하나만으로 모든 것을 다 할 수 있다"고 느끼게 하거나, 불가능하다면 "아주 직관적이고 자동으로 많은 것이 처리된다"는 인상을 줘야 한다.

---

## 1. 요구사항 요약

브레인스토밍을 통해 확정된 요구사항:

| 항목 | 결정 |
|---|---|
| 드라이브 형태 | 기존 공유 드라이브 (개인 계정 폴더 공유) |
| 폴더 구조 | 팀별 폴더가 이미 나뉘어 있음 |
| 동기화 시점 | 5분마다 백그라운드 + 수동 "새로고침" 버튼 |
| 파일 표시 | 메타데이터만 (파일명, 아이콘, 수정시각, 수정자, 링크) |
| UX 접근 | 활동 피드(파일 수정 + 앱 내 활동 통합)를 개요 탭에 통합 |
| 설정 주체 | 기획관리팀 1명이 1회 설정, 이후 완전 자동 |
| 비용 | 0원 (Vercel Hobby + Supabase Free + Google Drive API 무료) |

---

## 2. 사용자 경험 — 통합 활동 피드

### 팀 워크스페이스 개요 탭 개조

기존 "개요" 탭에 **최근 활동 피드**를 추가한다. 드라이브 파일 수정과 앱 내 활동(체크 완료, 결정 변경 등)을 시간순으로 병합하여 보여준다.

```
┌──────────────────────────────────────────────────────────┐
│  🟢 예산팀 · 진행률 30%                                    │
├──────────────────────────────────────────────────────────┤
│  [개요 ✨]  [지침]  [체크리스트]  [마일스톤]  [이슈]        │
├──────────────────────────────────────────────────────────┤
│  📋 미션                                                  │
│  예산안, 입장료, 식사, 단체티, 준비물 리스트               │
│  ────────────────────────────────────────────────────    │
│  📌 최근 활동                          [전체 보기 →]      │
│  📊 예산안.xlsx · 3시간 전 · 수민 · [↗ 열기]             │
│  ✅ 입장료 방향 논의 · 5시간 전 · 지훈                    │
│  📊 준비물.xlsx · 어제 · 수민 · [↗ 열기]                  │
│  ────────────────────────────────────────────────────    │
│  📁 드라이브 파일 (12)                   [전체 보기 →]   │
│  마지막 동기화: 3분 전                    [🔄 새로고침]   │
└──────────────────────────────────────────────────────────┘
```

### 활동 피드 데이터 소스

| 소스 | 내용 | 출처 |
|---|---|---|
| 드라이브 파일 수정 | 📊 파일명, 수정자, 수정 시각 | `drive_files` 테이블 |
| 앱 내 활동 | ✅ 체크 완료, 결정 변경 등 | `audit_log` 테이블 |

두 소스를 시간순으로 병합하여 상위 8개를 피드에 표시한다.

### 파일 전체 보기

개요 탭의 "📁 드라이브 파일 (N)" 영역에서 확장하면 전체 파일 목록이 표시된다. 각 파일은 파일명, 아이콘(구글 제공), 수정 시각, 수정자, "↗ 드라이브에서 열기" 링크를 표시한다.

### 미연결 상태

관리자가 아직 드라이브를 연결하지 않았다면, 파일 섹션에 부드럽게 안내한다: "구글 드라이브 연결이 설정되지 않았습니다. 기획관리팀에서 연결하면 파일이 자동으로 표시됩니다."

---

## 3. 아키텍처 & 인증

### 핵심 원칙: 팀원은 아무것도 설정하지 않는다

기획관리팀 1명이 1회 OAuth 연결하면, 모든 팀원이 자동으로 파일 목록을 볼 수 있다.

### 인증 흐름

1. 관리자가 `/settings` → "구글 드라이브 연결" 클릭
2. 구글 OAuth 동의 화면 (스코프: `drive.metadata.readonly`)
3. "허용" → 콜백 → 토큰 저장 (암호화)
4. "✓ 연결됨" 표시

### 기술 스택 추가

| 추가 | 용도 | 비용 |
|---|---|---|
| `googleapis` npm 패키지 | 구글 드라이브 API 클라이언트 | 무료 |
| Google Cloud 프로젝트 + OAuth | API 자격 증명 | 무료 |
| Supabase 테이블 2개 (`drive_tokens`, `drive_files`) | 토큰 + 파일 캐시 | 기존 DB 미세 추가 |
| teams 컬럼 1개 (`drive_folder_id`) | 폴더 매핑 | 기존 테이블 확장 |

---

## 4. 데이터 모델

### `drive_tokens` — OAuth 토큰 (싱글톤, 1행)

```sql
drive_tokens (
  id            int PK default 1,  -- 싱글톤
  email         text,              -- 'spideman671@gmail.com'
  access_token  text,              -- AES-256-GCM 암호화
  refresh_token text,              -- AES-256-GCM 암호화
  expires_at    timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
)
```

### `drive_files` — 파일 메타데이터 캐시

```sql
drive_files (
  id            uuid PK default gen_random_uuid(),
  team_id       text FK→teams.id,
  file_id       text unique,      -- 구글 드라이브 파일 ID
  name          text,             -- '26-2 예산안.xlsx'
  mime_type     text,             -- 'application/vnd.google-apps.spreadsheet'
  icon_link     text,             -- 구글 제공 아이콘 URL
  modified_time timestamptz,      -- 마지막 수정 시간
  modified_by   text,             -- 마지막 수정자 이름
  web_view_link text,             -- 클릭 시 열리는 URL
  last_synced   timestamptz default now()
)
```

> **삭제 정책:** `drive_files`에는 `deleted_at` soft-delete를 사용하지 않는다. 드라이브에서 삭제된 파일(구글 응답에 없는 파일)은 동기화 시 hard-delete로 즉시 제거한다. 이 테이블은 구글 드라이브의 캐시(미러)이지 앱의 사용자 데이터가 아니므로, 원본이 사라지면 캐시도 즉시 사라져야 한다.

### teams 테이블 확장

```sql
ALTER TABLE teams ADD COLUMN drive_folder_id text;
```

---

## 5. 동기화 로직

### 두 가지 트리거

1. **자동 (페이지 진입 시 신선도 확인):** 팀 페이지를 열면 캐시된 파일을 즉시 표시. 마지막 동기화가 5분 이상이면 백그라운드에서 갱신. 팀원은 모름. 완료 후 `router.refresh()`로 화면 반영.
2. **수동 ("🔄 새로고침" 버튼):** 팀원이 클릭하면 해당 팀만 즉시 갱신. "동기화 중..." → "최신 상태입니다" 토스트.

> Vercel Hobby Cron 제약(하루 100회)으로 인해 Cron 대신 페이지 진입 시 신선도 확인 방식을 사용한다.

### 동기화 절차

1. `drive_tokens`에서 토큰 조회 (서버 사이드, service_role 키)
2. `access_token` 만료 확인 → refresh_token으로 갱신
3. 각 팀의 `drive_folder_id`로 폴더 파일 목록 조회 (Google Drive API)
4. 응답을 `drive_files`에 upsert (file_id 기준)
5. DB에 있지만 구글 응답에 없는 파일 → 삭제
6. `last_synced` 갱신

### 동시성 안전

- upsert가 멱등이므로 중복 실행해도 결과 동일
- 마지막 동기화가 1분 이내면 중복 트리거 방지

---

## 6. 오류 처리

| 상황 | 팀원 경험 | 기술 대응 |
|---|---|---|
| 정상 동기화 | "최신 상태입니다" 토스트 (수동 시만) | drive_files upsert |
| 드라이브 미연결 | "연결 설정 필요" 안내 카드 | 빈 상태 + 가이드 |
| access_token 만료 (자동) | 모름 (백그라운드) | refresh_token 자동 갱신 |
| refresh_token 만료 | "재연결 필요. 기획관리팀에 문의" | 토큰 삭제 + 캐시 유지 |
| API 할당량 초과 | "잠시 후 다시 시도해주세요" | 캐시 유지, 5분 후 재시도 |
| 폴더 권한 없음 | "폴더에 접근할 수 없습니다" | 해당 팀만 빈 상태 |
| 네트워크 오류 | "동기화 실패. 캐시된 데이터 표시 중" | 기존 데이터 유지 |
| 빈 폴더 | "폴더에 파일이 없습니다" | 빈 배열 처리 |

모든 오류 상황에서 **캐시된 데이터는 유지**되며, 파일이 갑자기 사라지지 않는다.

---

## 7. 보안

### 토큰 암호화

OAuth 토큰은 AES-256-GCM으로 암호화하여 저장한다. 암호화 키는 Vercel 환경 변수 `DRIVE_ENCRYPTION_KEY` (32바이트)로 저장하며, 클라이언트에 노출되지 않는다.

### 토큰 테이블 RLS 강화

`drive_tokens`는 다른 테이블과 달리 클라이언트 읽기를 차단한다:

```sql
-- SELECT는 차단 (토큰 값 노출 방지)
CREATE POLICY "tokens_no_read" ON drive_tokens FOR SELECT USING (false);
-- INSERT/UPDATE는 anon 허용 (설정 시 필요)
CREATE POLICY "tokens_write" ON drive_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "tokens_update" ON drive_tokens FOR UPDATE USING (true);
```

토큰 조회/저장은 서버 사이드 Route Handler에서 service_role 키로 실행한다 (RLS 우회).

### 최소 권한 스코프

```
drive.metadata.readonly
```

파일 이름, 타입, 수정 시각, 수정자, 링크만 읽는다. 파일 내용은 읽지 않고, 생성/수정/삭제도 하지 않는다.

---

## 8. 환경 변수 (추가)

```bash
# 서버 전용 (NEXT_PUBLIC 접두사 없음)
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
DRIVE_ENCRYPTION_KEY=<32바이트 랜덤 문자열>
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_OAUTH_REDIRECT_URL=https://sportsday-hub.vercel.app/api/auth/google-callback
```

모든 구글 API 호출은 서버 사이드에서 실행되며, 클라이언트에 노출되는 것은 없다.

---

## 9. 관리자 설정 페이지 (`/settings`)

사이드바 하단에 "⚙️ 설정" 링크 추가. 한 페이지에서 드라이브 연결 + 폴더 매핑 처리:

1. "구글 드라이브 연결" → OAuth 팝업 → 동의 → "✓ 연결됨"
2. 5개 팀 폴더 URL 붙여넣기 → URL에서 폴더 ID 자동 추출
3. "저장하고 동기화" → 첫 동기화 실행

관리자의 전체 설정 시간: 약 5분 (구글 클라우드 프로젝트 설정 포함 시 약 35분, 1회만).

---

## 10. 프로젝트 구조 (추가 파일)

```
sportsday-hub/
├── app/
│   ├── settings/page.tsx              # 신규: 관리자 설정 페이지
│   └── api/
│       ├── auth/
│       │   ├── google-connect/route.ts  # 신규: OAuth 시작
│       │   └── google-callback/route.ts # 신규: OAuth 콜백
│       └── drive/
│           └── sync/route.ts           # 신규: 동기화 엔드포인트
├── lib/
│   ├── drive/
│   │   ├── client.ts                  # 신규: 구글 드라이브 API 클라이언트
│   │   ├── sync.ts                    # 신규: 동기화 로직
│   │   └── crypto.ts                  # 신규: 토큰 암호화/복호화
│   ├── queries/
│   │   ├── drive-files.ts             # 신규: 파일 캐시 쿼리
│   │   └── activity-feed.ts           # 신규: 통합 피드 쿼리
│   └── types/
│       └── models.ts                  # 수정: DriveFile, DriveToken 타입
├── components/
│   ├── drive/
│   │   ├── activity-feed.tsx          # 신규: 최근 활동 피드
│   │   ├── file-list.tsx              # 신규: 파일 전체 목록
│   │   └── file-card.tsx              # 신규: 개별 파일 카드
│   └── settings/
│       ├── drive-connection.tsx       # 신규: 연결 상태 카드
│       └── folder-mapping.tsx         # 신규: 팀 폴더 매핑
└── supabase/migrations/
    └── 0007_drive_integration.sql     # 신규: 테이블 + RLS
```

---

## 11. 참고 자료

- 기존 설계: `docs/superpowers/specs/2026-08-08-sportsday-hub-design.md`
- Plan A: `docs/superpowers/plans/2026-08-08-sportsday-hub-plan-a.md`
- Plan B: `docs/superpowers/plans/2026-08-08-sportsday-hub-plan-b.md`
