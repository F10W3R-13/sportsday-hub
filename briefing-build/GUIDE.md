# 브리핑 자료 제작 가이드 (비개발자용)

이 폴더는 26-2 스포츠데이에서 **호평을 받았던 브리핑 자료 3종**을 만든 코드입니다.

- `briefing_deck.js` → **최종 브리핑 덱** (18장 pptx, 발표자용)
- `board.js` → **현장 운영 보드** (12장 pptx → PNG으로 출력해 현장에 세팅)
- `sheet.js` → **발표자 치트시트** (pptx → pdf/png)
- `roster.js` — **명단·게임·배치 데이터의 단일 진실 원천.** 위 3개 스크립트가 모두 이 파일을 읽는다.
- `배치도_26-2.png` — 덱 F4슬라이드에 삽입되는 배치도 이미지 (올해 것으로 교체)
- `rules.txt`, `schedule_cells.txt` — 작년에 원본 문서에서 발췌해 두었던 참고 텍스트
- `assemble.py` — ⛔ **실행 금지** (작년 중간 과정의 일회용 도구. 덱 전용 슬라이드를 파괴함)

작년 완성품은 `../archive/2026-2/sports-day/` 에 있다 (덱 pptx/pdf, 보드 pptx, 보드 PNG 12장, 치트시트 pdf/png).
전체 검수 절차의 상세판: `../archive/2026-2/sports-day/브리핑 자료 검증 절차 (세션 이전).md`

---

## 0. 새 시즌 시작할 때

1. 이 `briefing-build/` 폴더 전체를 그대로 두고 `roster.js`의 데이터만 올해 것으로 교체한다.
   (스크립트의 레이아웃·디자인 코드는 손대지 않아도 된다)
2. **허브의 당일 페이지 데이터와 동기화**: 허브 `sportsday-hub/lib/dayof/data.ts` 에도
   같은 명단·배치를 반영한다 (양쪽 모두 수동 동기화 — 어느 한쪽만 고치면 어긋난다).
3. 올해 배치도 이미지를 이 폴더에 넣고 `briefing_deck.js`의 `배치도_26-2.png` 경로를 파일명에 맞게 고친다.

## 1. 준비 (최초 1회)

```
cd briefing-build
npm install        # pptxgenjs 설치 (package.json 참조)
```

## 2. 데이터 작성 — roster.js

`roster.js`를 열어 올해 값으로 교체한다. 구성(26-2 기준):

| 익스포트 | 내용 |
|---|---|
| `ROSTER_NAMES` | 당일 배치 전원 (가나다순) |
| `MR6` / `TEAMLEADS` / `VICELEADS` / `JUKSIK` / `MC` / `MAPLE6` | 직제별 명단 |
| `GATHER` | 아침 집합 (캠퍼스별 조·타임라인) |
| `MORNING` / `LUNCH` | 오전·점심 배치 표 |
| `AFTERNOON` | 오후 배치 (자유 텍스트) |
| `FLOW` | 입장 수속 플로우 단계 |
| `GAMES` | 게임 카드 (규칙·배정·물품·주의) |
| `WARN4` | 배정 주의 문구 |

**반드시 지킬 규칙** (허브 data.ts와 동일한 파싱 규약):
- 배치 텍스트에 등장하는 모든 이름은 `ROSTER_NAMES` 안에 있어야 한다 (오타 = 그 사람의 일정 누락).
- 게임 배정은 `"역할 — 이름 · 이름"` 형식으로 쓴다.

## 3. 빌드

출력 폴더는 스크립트 상단 `SEASON_DIR` 기본값(작년 아카이브)을 올해 폴더로 바꾸거나,
실행 시 환경변수로 지정한다:

```
:: Windows CMD — 올해 폴더를 지정해 빌드
set SEASON_DIR=C:\경로\27-1 Sports Day
node board.js && node briefing_deck.js && node sheet.js
```

- `board.js` → `SEASON_DIR\현장 운영 보드.pptx`
- `briefing_deck.js` → `SEASON_DIR\최종 브리핑 덱 (발표자용).pptx` (환경변수 `DECK_OUT`으로 단독 지정 가능)
- `sheet.js` → 이 폴더 안 `cheatsheet.pptx`

빌드가 끝나면 각 pptx를 연 뒤 **눈으로 검수**한다. 콘솔에 `WIDTH-OVER` 경고가 뜨면
해당 슬라이드의 텍스트가 상자를 넘는다는 뜻 — 문구를 줄이거나 글꼴을 줄인다.

## 4. PDF·PNG 변환 (LibreOffice 필요)

```
"C:\Program Files\LibreOffice\program\soffice.exe" --headless --convert-to pdf --outdir "출력폴더" "덱.pptx"
pdftoppm -png -r 110 "덱.pdf" 접두어
```

- 덱 인쇄본: pptx → pdf
- 현장 보드: pptx → pdf → PNG 12장 (파일명 규칙: `01_...` ~ `12_...`, 작년 아카이브 참조)
- 치트시트: `cheatsheet.pptx` → pdf → png

※ 한글 경로에서 변환이 간헐적으로 실패하면 pptx를 임시로 ASCII 경로(예: `C:\temp`)로 복사해 변환한다.
※ LibreOffice가 맑은 고딕을 대체 글꼴로 그리는 경우가 있다 — 완성본 검수는 반드시 원본 pptx나 고해상도 PNG에서.

## 5. 최종 검수 체크리스트

발표 전날 기준으로 전 슬라이드를 확인한다:

- [ ] 슬라이드 수·구성이 예상과 같은가 (작년: 덱 18장·보드 12장·치트시트 1장)
- [ ] **원본 명단 표(엑셀)와 대조** — 이름이 하나라도 어긋나면 즉시 정정. OCR·재타이핑 오류가 최대 리스크였음(작년 실제 사례: 이강서↔유주영 3곳 오기)
- [ ] 시각 표기가 타임라인 표와 일치하는가
- [ ] 겹치는 배정(촬영+부스 등)이 WARN 슬라이드에 반영됐는가
- [ ] 배치도 이미지가 올해 것인가
- [ ] PNG 재출력 시 바뀐 슬라이드만 다시 뽑았는가 (파일명 규칙 유지)

정정할 때는 **`roster.js`만 고치고 양쪽(보드·덱)을 모두 다시 빌드**한다 — 결과물을 직접 손대면 다음 빌드에서 되살아난다.

## 6. 마무리

- 최종 pptx/pdf/png는 시즌 폴더(아카이브 예정 위치)에 정리.
- 렌더 중간물(`cheatsheet.pptx`, `*.pdf`, `pages/` 등)은 git에 커밋되지 않는다(.gitignore).
