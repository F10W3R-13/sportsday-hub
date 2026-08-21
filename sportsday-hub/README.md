# HI-Side Out Hub

26-2 ìŠ¤í¬ì¸ ë°ì´ ê¸°íšíŒ€ í˜‘ì—… í—ˆë¸Œ.

## ê°œë°œ í™˜ê²½ ì„¤ì •

### ì‚¬ì „ ìš”êµ¬ì‚¬í•­
- Node.js v20+
- npm
- í´ë¼ìš°ë“œ Supabase í”„ë¡œì íŠ¸ (supabase.com ë¬´ë£Œ í‹°ì–´)

### ì„¤ì¹˜

```bash
npm install
```

### í™˜ê²½ ë³€ìˆ˜

`.env.local` ìƒì„±:

```bash
cp .env.local.example .env.local
# í´ë¼ìš°ë“œ Supabase URL/anon key ì…ë ¥ (Project Settings â†’ API)
```

### Supabase ì—°ê²° + ë§ˆì´ê·¸ë ˆì´ì…˜

```bash
npx supabase link --project-ref <í”„ë¡œì íŠ¸-ref>
npx supabase db push    # ë§ˆì´ê·¸ë ˆì´ì…˜ ì ìš©
```

### ë§ˆí¬ë‹¤ìš´ì—ì„œ ë°ì´í„° ì´ì£¼

ì›ë³¸ ë§ˆí¬ë‹¤ìš´(`content-source/`)ì—ì„œ ì‹œë“œ SQL ì¬ìƒì„±:

```bash
npm run migrate:md
npx supabase db push    # ì‹œë“œ ë§ˆì´ê·¸ë ˆì´ì…˜ ì ìš©
```

### ê°œë°œ ì„œë²„

```bash
npm run dev
```

`http://localhost:3000` ì ‘ì†.

### í…ŒìŠ¤íŠ¸

```bash
npm test          # ë§ˆí¬ë‹¤ìš´ íŒŒì„œ ë‹¨ìœ„/í†µí•© í…ŒìŠ¤íŠ¸
```

## ê¸°ìˆ  ìŠ¤íƒ

- Next.js 16 (App Router) + React 19
- shadcn/ui + Tailwind CSS v4
- Supabase (Postgres)
- TanStack Query v5
- react-markdown + remark-gfm

## ë°ì´í„° êµ¬ì¡°

- `supabase/migrations/` â€” Supabase SQL ë§ˆì´ê·¸ë ˆì´ì…˜
- `scripts/migrate-from-md.ts` â€” ë§ˆí¬ë‹¤ìš´ â†’ SQL ì‹œë“œ ë³€í™˜
- `content-source/` â€” ì´ì£¼ ì›ë³¸ ë§ˆí¬ë‹¤ìš´
- `lib/` â€” ì¿¼ë¦¬, íƒ€ì…, ìœ í‹¸

## Ä«Ä«¿ÀÅå ÀÚµ¿ ¾Ë¸²

- GET /api/cron/kakao-digest ? ¸ÅÀÏ ¾ÆÄ§ Vercel Å©·ĞÀÌ ÀÓ¹Ú ¸¶ÀÏ½ºÅæ¡¤ÀÎ°è¡¤Ã¼Å©¸®½ºÆ® ´ÙÀÌÁ¦½ºÆ®¸¦ Ä«Ä«¿ÀÅå '³ª¿¡°Ô º¸³»±â'·Î ¹ß¼Û (CRON_SECRET Bearer ÀÎÁõ)
- GET /api/digest/today ? PC ÀÚµ¿È­ ½ºÅ©¸³Æ®(scripts/kakao_group_sender.py)°¡ ´ÜÃ¼¹æ Àü¼Û¿ë detailed ´ÙÀÌÁ¦½ºÆ®¸¦ °¡Á®°¡´Â ¿£µåÆ÷ÀÎÆ® (°°Àº ÀÎÁõ)

