# 세션 요약 — 카카오톡 봇 구조 검증 및 결함 제거

> 날짜: 2026-09-11
> 범위: sportsday-hub 카카오톡 봇 전체(크론 2 + PC 스크립트 3 + 회복 체인)

## 검증 결과 (수정 전)

- tsc 0 에러, vitest 160/160, eslint 0 — 코드 품질 양호
- 회복 체인 실작동 확인: 9/10 18시 실패 → 22:14 자가 회복 → 마커 해제 → sync 5통 발송+커밋
- 그러나 아래 결함 발견 → 전부 수정

## 수정 내역

### P0 버그
1. **회복 백오프 없음** (9/10 실제 발생: 다이제스트 8회+/sync 10회+ 재시도, 경보 홍수)
   - `kakao_recover.py`: 레인당 하루 3회 초과 시 당일 포기(GiveUp 플래그), 성공 시 카운터 리셋
   - `kakao_group_sender.py`: `retry_report()` — 당일 실패 보고 레인당 1회만(플래그), 성공 보고는 항상
   - `drive_sync_bot.py`: 기존 보고 없던 것을 fail(발송 실패 시)/success(커밋 직후) 보고 추가 — watchdog이 sync 레인을 볼 수 있게 된 전제

### 경미한 결함
2. **watchdog 사각지대(22시 봇 미감시)**: watchdog이 23:10 KST로 이동, bot_runs detail `[sync]` 접두사로 양 레인 구분 감시.
   Hobby 크론 2슬롯 제약 확인(4크론 설계 폐기). 23:10이면 양 봇 보고 종료라 오경보 없음(Hobby 지터 안전).
3. **`startOfToday` 서버 TZ 의존**: KST 고정 헬퍼(`kstTodayStr`/`dayDiff`) 도입,
   milestones-urgency·kakao-digest·handoff·kakao-bot 전부 전환. UTC 시계에서 2개 테스트가
   실패하던 것이 실증 → 관련 테스트 TZ 명시 수정 + `tests/kst-time.test.ts` 9개 신설.
   **169/169 KST·UTC 양쪽 통과.**
4. **18시 태스크 EndBoundary 9/19 00:00** ← 실제 버그(행사 종료보다 2일 먼저 스케줄 종료).
   `Register-ScheduledTask -Force`로 9/20 18:00+09:00으로 수정. (recover 태스크에는
   EndBoundary 9/21 00:00이 원래 있었음 — "+로그온" 문구는 오기, 00:58 실행은 놓친 실행 보충)
5. **문서 불일치**: README 신설(스케줄·보고 규칙 문서화), recover docstring 24:00 표기,
   sender 실행예시 방이름 실제 등록값으로 수정.

### 불필요 요소 제거 (9/20 18:00 행사 종료 후)
- 태스크 3개: EndBoundary로 자동 소멸(수동 삭제 불필요) — 코드의 BOT_END 체크와 이중 안전망
- Vercel 크론: `isBotEnded()`로 조용히 종료 — 슬롯 2개 유지(다음 프로젝트 재활용 전제)
- doc_summaries.json·summary_cache: ZCode 21:40 파이프라인 인터페이스라 유지

## 남은 작업
- Vercel 재배포 필요(라이브 크론 시각 18:10→23:10, watchdog 레인 감시 반영)
- CRON_SECRET 로테이션 권장(이번 점검 중 PC 레지스트리 값이 터미널 출력에 노출됨)
- 23:10 watchdog은 다음날(9/12) 라이브 첫 가동 — 오늘 밴드 보고 흐름과 함께 확인

## 관련 파일
`lib/milestones-urgency.ts` `lib/kakao-digest.ts` `lib/handoff.ts` `lib/kakao-bot.ts`
`app/api/cron/kakao-bot-watchdog/route.ts` `vercel.json` `README.md`
`scripts/kakao_group_sender.py` `scripts/drive_sync_bot.py` `scripts/kakao_recover.py`
`tests/kst-time.test.ts`(신설) `tests/milestones-urgency.test.ts` `tests/handoff.test.ts` `tests/kakao-bot.test.ts`
