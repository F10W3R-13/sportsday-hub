# HI-Side Out Hub

26-2 스포츠데이 기획팀 협업 허브.

## 개발 환경 설정

### 사전 요구사항
- Node.js v20+
- npm
- 클라우드 Supabase 프로젝트 (supabase.com 무료 티어)

### 설치

```bash
npm install
```

### 환경 변수

`.env.local` 생성:

```bash
cp .env.local.example .env.local
# 클라우드 Supabase URL/anon key 입력 (Project Settings → API)
```

### Supabase 연결 + 마이그레이션

```bash
npx supabase link --project-ref <프로젝트-ref>
npx supabase db push    # 마이그레이션 적용
```

### 마크다운에서 데이터 이주

원본 마크다운(`content-source/`)에서 시드 SQL 재생성:

```bash
npm run migrate:md
npx supabase db push    # 시드 마이그레이션 적용
```

### 개발 서버

```bash
npm run dev
```

`http://localhost:3000` 접속.

### 테스트

```bash
npm test          # 마크다운 파서 단위/통합 테스트
```

## 기술 스택

- Next.js 16 (App Router) + React 19
- shadcn/ui + Tailwind CSS v4
- Supabase (Postgres)
- TanStack Query v5
- react-markdown + remark-gfm

## 데이터 구조

- `supabase/migrations/` — Supabase SQL 마이그레이션
- `scripts/migrate-from-md.ts` — 마크다운 → SQL 시드 변환
- `content-source/` — 이주 원본 마크다운
- `lib/` — 쿼리, 타입, 유틸

## īī���� �ڵ� �˸�

- GET /api/cron/kakao-digest ? ���� ��ħ Vercel ũ���� �ӹ� ���Ͻ��桤�ΰ衤üũ����Ʈ ��������Ʈ�� īī���� '������ ������'�� �߼� (CRON_SECRET Bearer ����)
- GET /api/digest/today ? PC �ڵ�ȭ ��ũ��Ʈ(scripts/kakao_group_sender.py)�� ��ü�� ���ۿ� detailed ��������Ʈ�� �������� ��������Ʈ (���� ����)


## 읽기 전용 데모 인스턴스 (2026-08-31)

채용용 포트폴리오에서는 운영 인스턴스 대신 **가상 데이터 + 읽기 전용** 데모를 노출한다.

- 데모 URL: https://sportsday-hub-demo.vercel.app (가상 데이터 — 실명·예산·구글 돌 링크 없음)
- `NEXT_PUBLIC_DEMO_MODE=1` 배포에서만: 상단 데모 배너, 클라이언트 쓰기 차단, `/settings` 접근 차단
- 운영 배포는 기존과 동일하게 동작 (플래그 미설정 시 전부 무동작)
- 구성/재현 절차: [docs/DEMO-DEPLOY-GUIDE.md](docs/DEMO-DEPLOY-GUIDE.md) 참조
