# 07. 문제해결 FAQ

## 앱·인프라

**사이트가 안 열려요 (Connection 실패)**
→ Supabase 무료 티어 절전일 가능성. supabase.com 접속 → 프로젝트 → Restore.

**배포 URL 이 로그인을 요구해요**
→ Vercel Deployment Protection(SSO). Settings → Deployment Protection → Vercel Authentication 끄기.

**빌드가 실패해요 (Vercel)**
→ Root Directory 가 `sportsday-hub` 인지, Framework가 Next.js인지 확인.
로컬에서 `npm run build` 가 통과하는지 먼저 검증.

**버튼을 눌러도 저장이 안 돼요**
→ 닉네임 미설정(좌측 하단). 데모 모드(NEXT_PUBLIC_DEMO_MODE=1)면 의도된 동작 — 0으로.
마일스톤 **신규 추가만** 안 되면 CHECKLIST_LOCKED — AI에게 잠금 해제 SQL을 요청
(update app_locks set locked = false where key = 'milestones_insert';).

**team 페이지가 404**
→ URL의 팀 id가 event-config.ts의 TEAM_IDS 왔는지 확인.

## 데이터·검증

**npm test 가 깨져요**
→ 메시지를 읽을 것. 대부분 "명단에 없는 이름" (오타) 또는 사전 누락.
data.ts/copy.ts 를 고치면 해결. 테스트 자체를 고치는 건 마지막 수단.

**migrate:md 를 운영 DB에 돌렸는데 중복돼요**
→ 0005 시드는 연초 1회용. 운영 중에는 UI에서 수정. 큰 개정 때는 기존 행 정리 후 재실행.

**날짜가 작년으로 표시돼요**
→ lib/event-config.ts의 EVENT_DATE_ISO. 앱 곳곳의 날짜는 전부 여기서 파생된다.

## 당일 페이지

**이름을 선택했는데 일정이 비었어요**
→ 그 이름이 배치 텍스트에 오타 없이 있는지. `npm test` 의 린터가 잡아준다.

**진행 중/지남 표시가 이상해요**
→ EVENT_DATE_ISO가 행사일인지, 시각 표기가 HH:MM 형식인지.

## 브리핑

**빌드 스크립트가 파일을 못 찾아요**
→ SEASON_DIR/DECK_OUT 환경변수 또는 스크립트 상단 기본값 (GUIDE 3장).

**PNG 변환이 실패해요**
→ 한글 경로 문제 가능성 — ASCII 경로에서 변환 (GUIDE 4장).

## 역사 노트 (2026-2 운영 기록)

- 카카오톡 단체방 자동발송봇·드라이브 동기화봇·긴급 다이제스트 크론은
  2026-09-18 전면 철폐됨. 이 저장소 어디에도 존재하지 않는다 — 문서에서 언급되면 옛 기록.
- 체크리스트 기능은 milestones 로 병합됨(구 checklist_items 없음).
- 데모 인스턴스(읽기전용 복제본) 운영법: `sportsday-hub/docs/DEMO-DEPLOY-GUIDE.md`
  (필요 시 언제든 같은 절차로 다시 만들 수 있음).
