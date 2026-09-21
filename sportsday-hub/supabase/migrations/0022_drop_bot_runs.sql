-- 카카오톡 시스템 폐지(2026-09-18): 단체방 봇 실행 보고 테이블 제거.
-- 앱 코드의 봇 보고 엔드포인트(app/api/kakao-bot/report)가 함께 삭제됐다.
drop table if exists public.bot_runs;
