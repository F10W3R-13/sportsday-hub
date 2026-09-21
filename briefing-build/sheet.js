const pptxgen = require("pptxgenjs");
const path = require("path");
const OUT = path.join(__dirname, "cheatsheet.pptx");

const PRIMARY = "4B3FA6", PTINT = "ECEAF7", PTINT2 = "F7F6FB", ACCENT = "F5A623";
const TEXT = "1F2937", MUTED = "6B7280", LINEC = "E2E8F0", WHITE = "FFFFFF";
const WARN = "B45309", WARNBG = "FFF6E5", DARK = "26224A";
const F = "Malgun Gothic";
const W = 13.33, H = 7.5, M = 0.4;
const softShadow = () => ({ type: "outer", color: "26224A", blur: 4, offset: 1, angle: 60, opacity: 0.10 });

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "스포츠데이 기획팀";
p.title = "발표자 치트시트";

const s = p.addSlide();
s.background = { color: WHITE };
s.addText("발표자 치트시트 — 최종 브리핑 40분 · 9/18 (목)", { x: M, y: 0.22, w: 10.5, h: 0.45, fontFace: F, fontSize: 21, bold: true, color: TEXT, margin: 0 });
s.addText("덱: 최종 브리핑 덱 18장 · 비상: 인원관리표 xlsx 열어두기", { x: 9.0, y: 0.3, w: 3.9, h: 0.35, fontFace: F, fontSize: 10.5, color: MUTED, align: "right", margin: 0 });

// ── 좌측: 40분 흐름 ──
s.addText("① 흐름 (장 번호 = 덱 슬라이드)", { x: M, y: 0.85, w: 6.9, h: 0.32, fontFace: F, fontSize: 13, bold: true, color: PRIMARY, margin: 0 });
const flow = [
  ["1~3장 · 4분", "오프닝", "표지 → 세 가지 확인 → 숫자 요약. 멘트: \"결정은 끝, 남은 건 실행\""],
  ["4장 · 2분", "집합·이동", "하클 최초 집합 — 명륜조 9:30 국제관 L · 율전조 10:00 현장. ⬜ 빈칸: 버스 대수(결정①)·탑승 명단"],
  ["5~6장 · 5분", "오전 배치", "준비·설치 → 입장 배치 (조장 기준). 포인트: 입장관리존 최우선 · 배치 문의=준비총괄(박하늘)"],
  ["7장 · 5분", "입장 절차", "6단계 플로우. ⬜ 빈칸 채우기 — \"추가 접수(현장 대기) 어떻게 받을까?\""],
  ["8~9장 · 5분", "오후 + 배치도", "게임 블록(상세는 카드) → 배치도. 포인트: 입장관리존→응급처치 전환 · 상시(집계·도장·페이스)"],
  ["10~16장 · 12분", "심판 (핵심)", "공통 배점 먼저 → 카드 6종. 주심 이름 불러 본인 확인. 질문: \"규칙(9/16) 안 읽은 분?\" \"리허설 해보신 분?\" ⚠충원 2건"],
  ["17~18장 · 7분", "결정·클로징", "6가지 결정 → 9/19 할 일 → \"내일은 현장, 모레는 축제\""],
];
flow.forEach((f, i) => {
  const y = 1.16 + i * 0.9;
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y, w: 6.9, h: 0.82, rectRadius: 0.05, fill: { color: i === 4 ? PTINT : PTINT2 }, line: { color: LINEC, width: 0.75 } });
  s.addText([
    { text: f[0] + "  ", options: { fontSize: 11, bold: true, color: "B97A00" } },
    { text: f[1], options: { fontSize: 12.5, bold: true, color: TEXT, breakLine: true } },
    { text: f[2], options: { fontSize: 10.5, color: MUTED } },
  ], { x: M + 0.14, y: y + 0.04, w: 6.65, h: 0.76, fontFace: F, margin: 0, paraSpaceAfter: 2 });
});

// ── 우측 상단: 결정 6건 ──
s.addText("② 결정 6가지 (17장) — 자리에서 답 내기", { x: 7.6, y: 0.85, w: 5.3, h: 0.32, fontFace: F, fontSize: 13, bold: true, color: PRIMARY, margin: 0 });
const dec = [
  "① 버스 — 2대(마스터) vs 3대(예산) + 귀환 셔틀 없음",
  "② 단체티 — 203장@9,460 vs 217장@15,200",
  "③ 하클 인원 — 53 vs 47 (점심·티 수량 기준)",
  "④ 심판 충원 — 색판 보조+1 · 계주 심판+1~2 (누가?)",
  "⑤ 중복 — 촬영(유주영·최준혁) 겹침 · 2부 도장/뽑기=메이플 3명(출석 확인)",
  "⑥ 우천 — 수성관 전환 기준·시점·결정자 (9/19 저녁 1차 안)",
];
s.addText(dec.map((t) => ({ text: t, options: { fontSize: 11.5, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } })),
  { x: 7.62, y: 1.2, w: 5.3, h: 2.6, fontFace: F, margin: 0, paraSpaceAfter: 7 });

// ── 우측 중단: 시작 전 체크 ──
s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 7.6, y: 3.95, w: 5.33, h: 1.55, rectRadius: 0.06, fill: { color: PTINT2 }, line: { color: LINEC, width: 0.75 } });
s.addText("③ 시작 전 체크", { x: 7.78, y: 4.05, w: 5, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: PRIMARY, margin: 0 });
const chk = [
  "프로젝터 16:9 · 덱 PPTX 열기 (백업: PDF)",
  "체크리스트 순회용 웹앱 탭 열기 (sportsday-hub)",
  "빈칸 펜 — 7장(추가 접수) · 17장(결정 기록)",
];
s.addText(chk.map((t) => ({ text: t, options: { fontSize: 11, color: TEXT, breakLine: true, bullet: { code: "25A1", indent: 10 } } })),
  { x: 7.82, y: 4.38, w: 5.05, h: 1.05, fontFace: F, margin: 0, paraSpaceAfter: 5 });

// ── 우측 하단: 오늘 밤 마무리 ──
s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 7.6, y: 5.62, w: 5.33, h: 1.55, rectRadius: 0.06, fill: { color: WARNBG }, line: { color: ACCENT, width: 1 } });
s.addText("④ 오늘 밤 마무리", { x: 7.78, y: 5.72, w: 5, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: WARN, margin: 0 });
const night = [
  "결정 6건 → 마스터 지침·예산안 반영",
  "심판 충원·조정 반영해 카드 재발행",
  "웹앱 미체크 정리 · PNG 정보방 공지",
];
s.addText(night.map((t) => ({ text: t, options: { fontSize: 11, color: TEXT, breakLine: true, bullet: { code: "25A1", indent: 10 } } })),
  { x: 7.82, y: 6.05, w: 5.05, h: 1.05, fontFace: F, margin: 0, paraSpaceAfter: 5 });

s.addNotes("A4 가로 인쇄용. 발표자 전용 — 투사하지 않음.");

p.writeFile({ fileName: OUT }).then(() => console.log("WROTE", OUT));
