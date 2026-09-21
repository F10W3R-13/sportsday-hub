const pptxgen = require("pptxgenjs");
const path = require("path");
const R = require("./roster.js");

// 저장소 루트 — 이 스크립트가 어느 컴퓨터·어느 폴더에 있어도 따라가도록 상대 경로화.
const ROOT = path.resolve(__dirname, "..");
// 산출물을 넣을 시즌 폴더 — 새 시즌에는 이 기본값을 바꾸거나
// 실행 시 환경변수로 지정:  set SEASON_DIR=C:\...\27-1 Sports Day && node briefing_deck.js
const SEASON_DIR = process.env.SEASON_DIR || path.join(ROOT, "archive", "2026-2", "sports-day");
const OUT = process.env.DECK_OUT || path.join(SEASON_DIR, "최종 브리핑 덱 (발표자용).pptx");

// ===== 팔레트/공통 =====
const PRIMARY = "4B3FA6", PTINT = "ECEAF7", PTINT2 = "F7F6FB", ACCENT = "F5A623";
const TEXT = "1F2937", MUTED = "6B7280", LINEC = "E2E8F0", WHITE = "FFFFFF";
const WARN = "B45309", WARNBG = "FFF6E5";
const DARK = "26224A", DARK2 = "343060";
const F = "Malgun Gothic";
const W = 13.33, H = 7.5, M = 0.5;
const softShadow = () => ({ type: "outer", color: "26224A", blur: 4, offset: 1, angle: 60, opacity: 0.10 });

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "스포츠데이 기획팀";
p.title = "HI-Side Out 최종 브리핑 (2026-09-18)";

// ===== 폭 자가검증 (full-width 9.85 / half 4.83) =====
function em(t) { let s = 0; for (const ch of String(t)) { const o = ch.codePointAt(0); s += (o < 128 || ch === " ") ? 0.55 : 1.0; } return s; }
function rowWidth(role, n, lead, tail) {
  return em(role) * 13 / 72 + (n ? em(` ${n}명`) * 11.5 / 72 : 0)
    + (lead ? em(`  조장 ${lead}`) * 12 / 72 : 0) + (tail ? em(" " + tail) * 11.5 / 72 : 0);
}
function checkRow(kind, role, n, lead, tail) {
  const lim = kind === "F" ? 9.85 : 4.83;
  const w = rowWidth(role, n, lead, tail);
  if (w > lim * 0.99) console.warn(`WIDTH-OVER ${w.toFixed(2)}/${lim} [${kind}] ${role}`);
}

function slideBase() { const s = p.addSlide(); s.background = { color: WHITE }; return s; }
function header(s, kicker, title, sub) {
  s.addText(kicker, { x: M, y: 0.26, w: 10, h: 0.28, fontFace: F, fontSize: 12, bold: true, color: PRIMARY, charSpacing: 2, margin: 0 });
  s.addText(title, { x: M, y: 0.52, w: 9.6, h: 0.55, fontFace: F, fontSize: 27, bold: true, color: TEXT, margin: 0 });
  if (sub) s.addText(sub, { x: 9.2, y: 0.52, w: 3.6, h: 0.55, fontFace: F, fontSize: 12, color: MUTED, align: "right", valign: "bottom", margin: 0 });
}
function srcNote(s, txt) { s.addText(txt, { x: M, y: 7.14, w: 11.5, h: 0.26, fontFace: F, fontSize: 10, color: MUTED, margin: 0 }); }

// ── 자료 0 · 하클 최초 집합 (보드·덱 공용 렌더) ──
function renderGather(s) {
  const G = R.GATHER;
  const card = (x, w, c) => {
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: 1.32, w, h: 2.5, rectRadius: 0.07, fill: { color: PTINT2 }, line: { color: LINEC, width: 0.75 }, shadow: softShadow() });
    s.addText(c.title, { x: x + 0.24, y: 1.5, w: w - 3.1, h: 0.42, fontFace: F, fontSize: 16.5, bold: true, color: PRIMARY, margin: 0 });
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: x + w - 2.86, y: 1.5, w: 2.62, h: 0.4, rectRadius: 0.06, fill: { color: ACCENT }, line: { type: "none" } });
    s.addText(c.chip, { x: x + w - 2.86, y: 1.5, w: 2.62, h: 0.4, fontFace: F, fontSize: 12, bold: true, color: "5b4200", align: "center", valign: "middle", margin: 0 });
    s.addText(c.who, { x: x + 0.24, y: 1.98, w: w - 0.48, h: 0.5, fontFace: F, fontSize: 11.5, color: MUTED, margin: 0, lineSpacingMultiple: 1.05 });
    c.rows.forEach((r, i) => {
      const y = 2.52 + i * 0.42;
      s.addText(r.t, { x: x + 0.24, y, w: 1.45, h: 0.38, fontFace: F, fontSize: 11.5, bold: true, color: "B97A00", valign: "middle", margin: 0 });
      s.addText([
        { text: r.d + "  ", options: { fontSize: 12.5, bold: true, color: TEXT } },
        { text: r.n, options: { fontSize: 12, color: PRIMARY, bold: true } },
      ], { x: x + 1.72, y, w: w - 1.96, h: 0.38, fontFace: F, valign: "middle", margin: 0 });
    });
  };
  card(M, 6.25, G.myeongryun);
  card(6.95, 5.88, G.yuljeon);

  // 아침 동선
  s.addText("아침 동선", { x: M, y: 4.0, w: 3, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: PRIMARY, margin: 0 });
  const cw = 2.82, cgap = 0.35, cy = 4.34;
  G.chips.forEach((c, i) => {
    const x = M + i * (cw + cgap);
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: cy, w: cw, h: 0.86, rectRadius: 0.07, fill: { color: i === G.chips.length - 1 ? PTINT : WHITE }, line: { color: i === G.chips.length - 1 ? PRIMARY : LINEC, width: 1 }, shadow: softShadow() });
    s.addText([
      { text: c[0], options: { fontSize: 13.5, bold: true, color: PRIMARY, breakLine: true } },
      { text: c[1], options: { fontSize: 10.5, color: TEXT } },
    ], { x: x + 0.14, y: cy + 0.08, w: cw - 0.28, h: 0.7, fontFace: F, margin: 0, paraSpaceAfter: 2, valign: "middle" });
    if (i < G.chips.length - 1) s.addText("→", { x: x + cw + 0.02, y: cy + 0.22, w: 0.32, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: ACCENT, align: "center", margin: 0 });
  });

  // 빈칸 — 브리핑에서 채움
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.48, w: W - 2 * M, h: 1.42, rectRadius: 0.07, fill: { color: WARNBG }, line: { color: ACCENT, width: 1.2 } });
  const ff = [{ text: "빈칸 — 브리핑에서 채움", options: { fontSize: 13, bold: true, color: WARN, breakLine: true } }];
  G.freefill.forEach((t) => ff.push({ text: t, options: { fontSize: 12, color: TEXT, bullet: { code: "25A1", indent: 10 } } }));
  s.addText(ff, { x: 0.78, y: 5.62, w: 7.4, h: 1.2, fontFace: F, margin: 0, paraSpaceAfter: 5 });
  s.addText([
    { text: "유의", options: { fontSize: 12, bold: true, color: WARN, breakLine: true } },
    { text: G.wait, options: { fontSize: 11.5, color: TEXT, breakLine: true } },
    { text: G.weather, options: { fontSize: 11.5, color: TEXT } },
  ], { x: 8.45, y: 5.62, w: 4.2, h: 1.2, fontFace: F, margin: 0, paraSpaceAfter: 5, valign: "top" });
}

// 배치 보드 전용: 행 렌더러 (rows: [{k:'F',role,n,lead} | {k:'H',l:{...},r:{...}} | {k:'N',text}])
const CX = 2.55, CW = 9.9, HALF = (CW - 0.24) / 2;
const PITCH = 0.28;
function blockText(s, x, y, w, role, n, lead, tail) {
  const runs = [
    { text: role, options: { fontSize: 13, bold: true, color: PRIMARY } },
    { text: n ? ` ${n}명` : "", options: { fontSize: 11.5, bold: true, color: "B97A00" } },
    { text: lead ? `  조장 ${lead}` : "", options: { fontSize: 12, bold: true, color: TEXT } },
    { text: tail ? `  ${tail}` : "", options: { fontSize: 11.5, italic: true, color: MUTED } },
  ];
  s.addText(runs, { x, y, w, h: PITCH, fontFace: F, margin: 0, valign: "middle" });
}
function renderRows(s, y0, rows) {
  let y = y0;
  for (const row of rows) {
    if (row.k === "F") { checkRow("F", row.role, row.n, row.lead); blockText(s, CX, y, CW, row.role, row.n, row.lead); }
    else if (row.k === "H") {
      if (row.l) { checkRow("H", row.l.role, row.l.n, row.l.lead); blockText(s, CX, y, HALF, row.l.role, row.l.n, row.l.lead); }
      if (row.r) { checkRow("H", row.r.role, row.r.n, row.r.lead); blockText(s, CX + HALF + 0.24, y, HALF, row.r.role, row.r.n, row.r.lead); }
    } else if (row.k === "N") {
      s.addText([{ text: row.text, options: { fontSize: 11.5, color: MUTED, italic: true } }],
        { x: CX, y, w: CW, h: PITCH, fontFace: F, margin: 0, valign: "middle" });
    }
    y += PITCH;
  }
  return y;
}
function bandTop(s, y, h, time, label) {
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y, w: W - 2 * M, h, rectRadius: 0.05, fill: { color: PTINT2 }, line: { color: LINEC, width: 0.75 } });
  s.addText(time, { x: 0.66, y: y + 0.06, w: 1.8, h: 0.3, fontFace: F, fontSize: 14, bold: true, color: PRIMARY, margin: 0 });
  if (label) s.addText(label, { x: 0.66, y: y + 0.36, w: 1.82, h: h - 0.4, fontFace: F, fontSize: 10.5, color: MUTED, margin: 0, lineSpacingMultiple: 1.0 });
}
function band(s, y, time, label, rows, gap = 0.1) {
  const inner = 0.46 + rows.length * PITCH + 0.06;
  bandTop(s, y, inner, time, label);
  renderRows(s, y + 0.44, rows);
  return y + inner + gap;
}

// 컴팩트 밴드 (오후 보드 전용): 행간 0.25, 헤더 0.36, 라벨 없음
const PITCH2 = 0.25;
function bandC(s, y, time, rows, gap = 0.07) {
  const inner = 0.36 + rows.length * PITCH2;
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y, w: W - 2 * M, h: inner, rectRadius: 0.05, fill: { color: PTINT2 }, line: { color: LINEC, width: 0.75 } });
  s.addText(time, { x: 0.66, y: y + 0.04, w: 1.8, h: 0.28, fontFace: F, fontSize: 13, bold: true, color: PRIMARY, margin: 0 });
  let yy = y + 0.33;
  for (const r of rows) {
    checkRow("F", r, 0, 0);
    s.addText(r, { x: CX, y: yy, w: CW, h: PITCH2, fontFace: F, fontSize: 12, color: TEXT, margin: 0, valign: "middle" });
    yy += PITCH2;
  }
  return y + inner + gap;
}

// =========================================================
// F1 — 표지
// =========================================================
(() => {
  const s = p.addSlide();
  s.background = { color: DARK };
  s.addText("26-2 스포츠데이 기획팀 · 행사 전 최종 브리핑", { x: 0.9, y: 1.15, w: 8.5, h: 0.35, fontFace: F, fontSize: 15, bold: true, color: ACCENT, charSpacing: 1, margin: 0 });
  s.addText("HI-SIDE OUT", { x: 0.85, y: 1.55, w: 9.0, h: 1.15, fontFace: F, fontSize: 64, bold: true, color: WHITE, margin: 0 });
  s.addText("인사이드아웃 컨셉 · 율전 대운동장 · 6개 감정 팀", { x: 0.9, y: 2.78, w: 8.5, h: 0.4, fontFace: F, fontSize: 18, color: "C9C4E8", margin: 0 });
  ["F2C14E","4C9BE8","E5533D","63B063","9B7BD4","F28C3D"].forEach((c, i) => {
    s.addShape(p.shapes.OVAL, { x: 0.92 + i * 0.26, y: 3.4, w: 0.15, h: 0.15, fill: { color: c }, line: { type: "none" } });
  });
  s.addText([
    { text: "2026. 9. 20 (일) 10:00–19:00", options: { fontSize: 24, bold: true, color: WHITE, breakLine: true } },
    { text: "교환학생 150명 + 하이클럽 45명 · 6팀 · 우천 시 수성관", options: { fontSize: 14, color: "C9C4E8" } },
  ], { x: 0.9, y: 3.9, w: 8.5, h: 1.1, fontFace: F, margin: 0, paraSpaceAfter: 6 });
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 0.9, y: 5.4, w: 2.5, h: 0.66, rectRadius: 0.1, fill: { color: ACCENT }, line: { type: "none" } });
  s.addText("행사까지 D-2", { x: 0.9, y: 5.4, w: 2.5, h: 0.66, fontFace: F, fontSize: 20, bold: true, color: DARK, align: "center", valign: "middle", margin: 0 });
  s.addText("2026. 9. 18 (목) · 기획팀 전체", { x: 0.9, y: 6.35, w: 6, h: 0.3, fontFace: F, fontSize: 12, color: "8F89B8", margin: 0 });
  s.addNotes("[1분] 인사 후: '큰 결정과 주문은 다 끝났고, 오늘은 당일 실행 세부만 확정하는 자리. 40분 잡고 있습니다.'");
})();

// =========================================================
// F2 — 오늘의 목적
// =========================================================
(() => {
  const s = slideBase();
  header(s, "AGENDA", "오늘 확인하고 끝낼 것, 세 가지");
  const items = [
    { n: "1", t: "심판 배정 확정", d: "게임 6종 주심·보조심판 — 카드 보며 본인 확인", tag: "심판 카드" },
    { n: "2", t: "심판 규칙 숙지 확인", d: "9/16 배포 규칙 — 못 읽은 사람 오늘 명단화", tag: "9/16 완료 여부" },
    { n: "3", t: "리허설 완료 확인", d: "사전 진행 연습 — 미완 시 9/19 보완 계획", tag: "D-1 보완" },
  ];
  items.forEach((it, i) => {
    const x = M + i * 4.18;
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 3.9, h: 2.6, rectRadius: 0.07, fill: { color: WHITE }, line: { color: LINEC, width: 0.75 }, shadow: softShadow() });
    s.addText(it.n, { x: x + 0.25, y: 1.82, w: 1.0, h: 0.9, fontFace: F, fontSize: 52, bold: true, color: PRIMARY, margin: 0 });
    s.addText(it.t, { x: x + 0.25, y: 2.72, w: 3.4, h: 0.42, fontFace: F, fontSize: 19, bold: true, color: TEXT, margin: 0 });
    s.addText(it.d, { x: x + 0.25, y: 3.16, w: 3.4, h: 0.68, fontFace: F, fontSize: 12.5, color: MUTED, margin: 0 });
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: x + 0.25, y: 3.86, w: 1.8, h: 0.32, rectRadius: 0.05, fill: { color: PTINT }, line: { type: "none" } });
    s.addText(it.tag, { x: x + 0.25, y: 3.86, w: 1.8, h: 0.32, fontFace: F, fontSize: 10.5, bold: true, color: PRIMARY, align: "center", valign: "middle", margin: 0 });
  });
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y: 4.65, w: W - 2 * M, h: 1.9, rectRadius: 0.08, fill: { color: DARK }, line: { type: "none" }, shadow: softShadow() });
  s.addText([
    { text: "“모든 결정과 주문은 끝났습니다. 남은 것은 당일 실행.”", options: { fontSize: 23, bold: true, color: WHITE, breakLine: true } },
    { text: "부수 안건 — 정할 것 6가지(버스·단체티·하클 인원·심판 충원·중복 배정·우천 기준) + 빈칸 채우기(추가 접수 절차)", options: { fontSize: 13, color: "C9C4E8" } },
  ], { x: 0.95, y: 4.9, w: 11.4, h: 1.4, fontFace: F, margin: 0, paraSpaceAfter: 10, valign: "middle" });
  s.addNotes("[2분] 세 가지가 오늘의 종료 조건. 다 정하면 내일(9/19)은 현장 점검만 남는다고 못 박기.");
})();

// =========================================================
// F3 — 확정 요약
// =========================================================
(() => {
  const s = slideBase();
  header(s, "ANCHOR", "숫자로 보는 9.20 — 다 아는 내용, 기준만 확인");
  const stats = [
    { v: "9.20 (일)", l: "행사 일시", sub: "10:00~19:00 · 개회 13:00" },
    { v: "150 + 45", l: "교환 + 하클", sub: "6팀 · 팀장 6 인솔" },
    { v: "6 + 2", l: "토너먼트 + 메인", sub: "미니게임 부스 6종 상시" },
    { v: "36.8만", l: "예상 적자", sub: "총지출 726만 · 보전 전제" },
  ];
  stats.forEach((st, i) => {
    const x = M + i * 3.14;
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: 1.55, w: 2.94, h: 2.1, rectRadius: 0.07, fill: { color: WHITE }, line: { color: LINEC, width: 0.75 }, shadow: softShadow() });
    s.addText(st.v, { x: x + 0.22, y: 1.75, w: 2.55, h: 0.8, fontFace: F, fontSize: 33, bold: true, color: PRIMARY, margin: 0 });
    s.addText(st.l, { x: x + 0.22, y: 2.55, w: 2.5, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: TEXT, margin: 0 });
    s.addText(st.sub, { x: x + 0.22, y: 2.9, w: 2.55, h: 0.6, fontFace: F, fontSize: 11.5, color: MUTED, margin: 0 });
  });
  const rows = [
    ["장소", "율전 대운동장 (우천 시 수성관 — 기준은 오늘 결정 ⑥)"],
    ["이동", "명륜 국제관 L 9:30 집합 → 버스 10:00 출발 · 편도 (대수는 결정 ①)"],
    ["점수", "토너먼트 100/80/60/40/20/10 · 메인 ×1.5 · 계주 하클 격파 +10"],
  ];
  rows.forEach((r, i) => {
    const y = 4.1 + i * 0.72;
    s.addShape(p.shapes.OVAL, { x: M + 0.05, y: y + 0.13, w: 0.15, h: 0.15, fill: { color: i === 2 ? ACCENT : PRIMARY }, line: { type: "none" } });
    s.addText(r[0], { x: M + 0.35, y, w: 1.1, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: TEXT, margin: 0 });
    s.addText(r[1], { x: 1.95, y, w: 10.8, h: 0.4, fontFace: F, fontSize: 15, color: TEXT, margin: 0 });
    if (i < 2) s.addShape(p.shapes.LINE, { x: M, y: y + 0.58, w: W - 2 * M, h: 0, line: { color: LINEC, width: 0.75 } });
  });
  s.addNotes("[2분] '다 아시는 내용이라 30초씩만' 톤으로. 장소·버스·점수 세 줄이 오늘 결정 사항과 직결됨을 예고.");
})();

// =========================================================
// F3B — 자료 0 · 하클 최초 집합 (9/20 아침)
// =========================================================
(() => {
  const s = slideBase();
  header(s, "자료 0 · 최초 집합 안내", "하클 인원 최초 집합 — 9/20 (일) 아침", "명륜조 09:30 · 율전조 10:00");
  renderGather(s);
  srcNote(s, "출처: 최종기획안 '2. 타임라인 & 인원관리표' 9:30~10:30 · 버스 대수·탑승 명단은 브리핑 안건(결정 ①)");
  s.addNotes(R.GATHER.note);
})();

// =========================================================
// S1 — 자료 1-A · 오전 준비 (09:30~11:50)
// =========================================================
(() => {
  const s = slideBase();
  header(s, "자료 1-A · 시간대별 인원 배치", "오전 준비 — 09:30 ~ 11:50", "조장 기준 — 전원 명단은 인원관리표·웹앱");
  let y = 1.22;
  for (const b of R.MORNING) y = band(s, y, b.time, b.label, b.rows);
  srcNote(s, "출처: 최종기획안 '2. 타임라인 & 인원관리표' (2026-09) · 조장 = 인원관리표 첫 담당자 · 입장 관리존 = 천막 3 · 테이블 4 · 노트북 4");
  s.addNotes("오전은 설치 승부. 입장 관리존 최우선, 11:15 점심 수령 후 하클 식사. 배치 문의 → 준비 총괄(박하늘). 전원 명단은 인원관리표·웹앱.");
})();

// =========================================================
// S2 — 자료 1-B · 입장·개회 (11:50~13:00)
// =========================================================
(() => {
  const s = slideBase();
  header(s, "자료 1-B · 시간대별 인원 배치", "입장 수속 · 개회 — 11:50 ~ 13:00", "조장 기준 — 전원 명단은 인원관리표·웹앱");
  let y = 1.22;
  for (const b of R.LUNCH) y = band(s, y, b.time, b.label, b.rows);
  // 하단 보충 박스
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y: y + 0.12, w: W - 2 * M, h: 1.7, rectRadius: 0.07, fill: { color: PTINT }, line: { type: "none" } });
  s.addText([
    { text: "이 1시간의 체크포인트", options: { fontSize: 13.5, bold: true, color: PRIMARY, breakLine: true } },
    { text: "도장판 3종 기재 — 팀 · 티셔츠 사이즈 · 비건 여부 (단체티·점심 배부의 진본)", options: { fontSize: 12.5, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } },
    { text: "버스 인솔 6명은 탑승 → 율전 도착 후 입구에서 대기", options: { fontSize: 12.5, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } },
    { text: "우천 시에도 절차 동일 — 수성관 내 입장 관리존", options: { fontSize: 12.5, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } },
  ], { x: 0.78, y: y + 0.28, w: 11.6, h: 1.4, fontFace: F, margin: 0, paraSpaceAfter: 6 });
  srcNote(s, "출처: 최종기획안 인원관리표 11:50~12:50 · 절차 상세(6단계 플로우)는 자료 2 슬라이드 참조");
  s.addNotes("입장 수속 명단 배치 버전. 절차 순서는 다음 장(자료 2) 플로우로 설명. 추가 접수 절차는 브리핑에서 결정.");
})();

// =========================================================
// S3 — 자료 2 · 입장 수속 플로우
// =========================================================
(() => {
  const s = slideBase();
  header(s, "자료 2 · 입장 수속 플로우", "11:50 ~ 12:50 — 버스 도착부터 팀 천막까지");
  const bw = 1.86, gap = 0.14, x0 = M, y0 = 1.5, bh = 2.9;
  R.FLOW.forEach((st, i) => {
    const x = x0 + i * (bw + gap);
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: y0, w: bw, h: bh, rectRadius: 0.07, fill: { color: i === 2 ? PTINT : WHITE }, line: { color: i === 2 ? PRIMARY : LINEC, width: i === 2 ? 1.2 : 0.75 }, shadow: softShadow() });
    s.addShape(p.shapes.OVAL, { x: x + 0.12, y: y0 + 0.12, w: 0.34, h: 0.34, fill: { color: PRIMARY }, line: { type: "none" } });
    s.addText(String(i + 1), { x: x + 0.12, y: y0 + 0.12, w: 0.34, h: 0.34, fontFace: F, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
    s.addText(st.t, { x: x + 0.1, y: y0 + 0.52, w: bw - 0.2, h: 0.58, fontFace: F, fontSize: 13.5, bold: true, color: TEXT, margin: 0, lineSpacingMultiple: 0.95 });
    s.addText(st.d, { x: x + 0.1, y: y0 + 1.1, w: bw - 0.2, h: 0.72, fontFace: F, fontSize: 11.5, color: MUTED, margin: 0, lineSpacingMultiple: 1.05 });
    s.addText(st.n, { x: x + 0.1, y: y0 + 1.86, w: bw - 0.2, h: 0.98, fontFace: F, fontSize: 10.5, color: PRIMARY, bold: true, margin: 0, lineSpacingMultiple: 1.1 });
    if (i < 5) s.addText("→", { x: x + bw - 0.06, y: y0 + 1.15, w: 0.3, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: ACCENT, margin: 0 });
  });
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y: 4.7, w: 8.1, h: 2.2, rectRadius: 0.07, fill: { color: PTINT2 }, line: { color: LINEC, width: 0.75 } });
  s.addText("예외 처리 — 지각생 입장 관리: 성현중 · 양서경 (12:50~13:30까지 계속)", { x: 0.75, y: 4.85, w: 7.7, h: 0.32, fontFace: F, fontSize: 12.5, bold: true, color: TEXT, margin: 0 });
  const ex = [
    "입장료 미납 → 현장 수금 + receipt 제공",
    "단체티 사이즈 불일치 → 본부 보고 후 조정",
    "우천 시에도 수속 동일 (수성관 내 입장 관리존)",
  ];
  s.addText(ex.map((t) => ({ text: t, options: { fontSize: 12, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } })),
    { x: 0.78, y: 5.22, w: 7.6, h: 1.5, fontFace: F, margin: 0, paraSpaceAfter: 6 });
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 8.85, y: 4.7, w: 3.98, h: 2.2, rectRadius: 0.07, fill: { color: WARNBG }, line: { color: ACCENT, width: 1.2 } });
  s.addText([
    { text: "빈칸 — 브리핑에서 채움", options: { fontSize: 13, bold: true, color: WARN, breakLine: true } },
    { text: "추가 접수(현장 대기) 절차", options: { fontSize: 12, color: TEXT, breakLine: true, bullet: { code: "25A1", indent: 10 } } },
    { text: "인원 초과 시 티/식사 배분 규칙", options: { fontSize: 12, color: TEXT, bullet: { code: "25A1", indent: 10 } } },
  ], { x: 9.1, y: 4.9, w: 3.5, h: 1.8, fontFace: F, margin: 0, paraSpaceAfter: 8 });
  srcNote(s, "출처: 최종기획안 '1. 행사 기획안' 입장 수속 1~3 + 인원관리표 11:50~12:50 · 입장 관리존: 천막 3 · 테이블 4 · 노트북 4");
  s.addNotes("가장 혼잡한 1시간. 3번 도장판(팀·사이즈·비건)이 단체티·점심 배부의 진본. 추가 접수 절차는 이 자리에서 결정.");
})();

// =========================================================
// S4 — 자료 1-C · 오후 (13:00~18:00)
// =========================================================
(() => {
  const s = slideBase();
  header(s, "자료 1-C · 시간대별 인원 배치", "오후 — 13:00 ~ 18:00", "게임 상세는 심판 카드(자료 3) 참조");
  let y = 1.12;
  for (const b of R.AFTERNOON) y = bandC(s, y, b.time, b.rows);
  srcNote(s, "게임 공통 — 사회 김지원·김소라 · 교환 인솔 팀장 6 (배현빈 박서윤 이도연 강재희 김나은 전윤정) · ⚠ 촬영 2명은 부스운영/보조심판과 겹침 — 브리핑에서 조정");
  s.addNotes("오후는 게임 블록 단위. 심판 상세 규칙·명단은 자료 3 카드 단일 참조. 촬영 겹침(유주영 제기차기·최준혁 피구 보조)은 공통 카드 ⚠ 참조.");
})();

// =========================================================
// F4 — 배치도 (투사)
// =========================================================
(() => {
  const s = slideBase();
  header(s, "VENUE", "대운동장 배치도 — 설치 구역과 담당");
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.55, w: 8.3, h: 5.15, rectRadius: 0.07, fill: { color: WHITE }, line: { color: LINEC, width: 0.75 }, shadow: softShadow() });
  s.addImage({ path: path.join(__dirname, "배치도_26-2.png"), x: 0.75, y: 1.8, w: 7.8, h: 4.3, sizing: { type: "contain", w: 7.8, h: 4.3 } });
  s.addText("출처: 최종기획안 '7. 스포츠데이 배치도'", { x: M, y: 6.78, w: 6, h: 0.28, fontFace: F, fontSize: 10, color: MUTED, margin: 0 });
  const zones = [
    { t: "입장 관리존", d: "천막 3 · 테이블 4 · 노트북 4 — 최우선 설치 → 이후 응급처치 존 전환" },
    { t: "경기장", d: "60m × 40m · 콘 마킹 (설치: 예건희 외 8)" },
    { t: "팀별 대기존", d: "천막 12 (팀당 2) + 돗자리" },
    { t: "미니게임 부스", d: "천막 3 — 1부 A / 2부 B (구성 상이)" },
    { t: "본부", d: "천막 2 · 테이블 3 · 집계 노트북 2 · 사회자 대기" },
  ];
  zones.forEach((z, i) => {
    const y = 1.6 + i * 1.02;
    s.addShape(p.shapes.OVAL, { x: 9.15, y: y + 0.1, w: 0.14, h: 0.14, fill: { color: i === 0 ? ACCENT : PRIMARY }, line: { type: "none" } });
    s.addText(z.t, { x: 9.42, y, w: 3.4, h: 0.32, fontFace: F, fontSize: 14, bold: true, color: TEXT, margin: 0 });
    s.addText(z.d, { x: 9.42, y: y + 0.33, w: 3.45, h: 0.6, fontFace: F, fontSize: 11.5, color: MUTED, margin: 0 });
  });
  s.addNotes("[3분] 배치 질문은 준비 총괄(박하늘·이대현). 입장 관리존이 응급처치로 전환된다는 점 강조.");
})();

// =========================================================
// S5 — 자료 3-0 · 심판 공통
// =========================================================
(() => {
  const s = slideBase();
  header(s, "자료 3-0 · 심판 공통", "점수 · 대진 · 운영 공통 규칙");
  const tbl = (x, title, vals, main) => {
    s.addText(title, { x, y: 1.3, w: 6.3, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: main ? WARN : PRIMARY, margin: 0 });
    const hd = (t, fillC, colC) => ({ text: t, options: { fill: { color: fillC }, color: colC, bold: true, fontFace: F, fontSize: 12, align: "center", valign: "middle" } });
    const rows = [
      [hd("순위", main ? ACCENT : PRIMARY, "FFFFFF"), ...["1위","2위","3위","4위","5위","6위"].map((r) => hd(r, main ? WARNBG : PTINT, TEXT))],
      [hd("점수", main ? WARNBG : PTINT, main ? WARN : PRIMARY), ...vals.map((v) => ({ text: v, options: { fill: { color: "FFFFFF" }, color: TEXT, fontFace: F, fontSize: 13, bold: true, align: "center", valign: "middle" } }))],
    ];
    s.addTable(rows, { x, y: 1.62, w: 6.3, colW: [1.05, 0.875, 0.875, 0.875, 0.875, 0.875, 0.875], border: { pt: 0.75, color: LINEC }, rowH: 0.42, margin: 0.02 });
  };
  tbl(M, "토너먼트 (색판 · 무궁화 · 줄다리기 · 피구)", ["100","80","60","40","20","10"], false);
  tbl(6.85, "메인 게임 ×1.5 (짝찾기 · 계주)", ["150","120","90","60","30","15"], true);

  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y: 2.85, w: 6.3, h: 1.85, rectRadius: 0.07, fill: { color: PTINT2 }, line: { color: LINEC, width: 0.75 } });
  s.addText("6팀 토너먼트 대진 (부전승 포함)", { x: 0.75, y: 2.98, w: 5.6, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: PRIMARY, margin: 0 });
  s.addText([
    { text: "제비뽑기 2팀 → 준결승 직행 (부전승)", options: { fontSize: 12, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } },
    { text: "남은 4팀 제비뽑기 → 1라운드 2경기", options: { fontSize: 12, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } },
    { text: "순위 — 1위 결승승자 · 2위 결승패자 · 3위 준결승패자中승 · 4위 준결승패자中패 · 5위 1라운드패자中승 · 6위 1라운드패자中패", options: { fontSize: 12, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } },
    { text: "→ 부전승 팀도 1~6위 정상 확정, 배점 그대로 적용", options: { fontSize: 12, bold: true, color: PRIMARY, bullet: { code: "2013", indent: 10 } } },
  ], { x: 0.78, y: 3.3, w: 5.85, h: 1.35, fontFace: F, margin: 0, paraSpaceAfter: 5 });

  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 6.85, y: 2.85, w: 5.98, h: 1.85, rectRadius: 0.07, fill: { color: PTINT2 }, line: { color: LINEC, width: 0.75 } });
  s.addText("미니게임 — 스탬프 투어 (토너먼트 점수 무관)", { x: 7.1, y: 2.98, w: 5.5, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: PRIMARY, margin: 0 });
  s.addText([
    { text: "성공 시 도장 1개 (칸별 중복 불가) · 실패 시 줄 뒤로 재도전 가능", options: { fontSize: 12, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } },
    { text: "도장 2개 = 뽑기 1회 (뽑기 후 도장에 체크)", options: { fontSize: 12, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } },
    { text: "1부 부스 A — 제기차기 · 비어퐁 · 단체 줄넘기", options: { fontSize: 12, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } },
    { text: "2부 부스 B — 감정 몸짓 퀴즈 · 페트병 세우기 · 병뚜껑 컬링", options: { fontSize: 12, color: TEXT, bullet: { code: "2013", indent: 10 } } },
  ], { x: 7.13, y: 3.3, w: 5.5, h: 1.35, fontFace: F, margin: 0, paraSpaceAfter: 5 });

  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y: 4.95, w: 6.3, h: 0.85, rectRadius: 0.07, fill: { color: PTINT }, line: { type: "none" } });
  s.addText([
    { text: "점수 전달  ", options: { fontSize: 13, bold: true, color: PRIMARY } },
    { text: "경기 종료 즉시 본부 옆 점수집계 부스로 — " + R.JUKSIK + " (노트북 2대)", options: { fontSize: 12.5, color: TEXT } },
  ], { x: 0.75, y: 4.95, w: 5.85, h: 0.85, fontFace: F, margin: 0, valign: "middle" });

  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 6.85, y: 4.95, w: 5.98, h: 1.85, rectRadius: 0.07, fill: { color: WARNBG }, line: { color: ACCENT, width: 1.2 } });
  s.addText("⚠ 브리핑에서 확인 — 원문 대비 배정 차이", { x: 7.1, y: 5.08, w: 5.5, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: WARN, margin: 0 });
  s.addText(R.WARN4.map((t) => ({ text: t, options: { fontSize: 12, color: TEXT, breakLine: true, bullet: { code: "2013", indent: 10 } } })),
    { x: 7.13, y: 5.42, w: 5.55, h: 1.3, fontFace: F, margin: 0, paraSpaceAfter: 5 });

  srcNote(s, "출처: '스포츠데이 컨텐츠팀.docx' (점수표·대진·심판 표 원문 발췌) · 배정 차이는 인원관리표와의 대조 결과");
  s.addNotes("공통 카드로 시작해 전 심판이 배점을 동일하게 이해하게 한다. ⚠ 3건은 브리핑에서 자리에서 조정 결정. ('박서원·안령인 겹침'은 시트 대조 결과 오류로 삭제 — 두 사람은 병뚜껑 컬링만 담당, 2부 도장/뽑기는 메이플 지원 담당.)");
})();

// =========================================================
// S6~S11 — 심판 카드 6종
// =========================================================
function refereeCard(g) {
  const s = slideBase();
  header(s, `자료 3-${g.idx} · 심판 카드`, g.name, g.time);
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 9.0, y: 0.3, w: 1.5, h: 0.4, rectRadius: 0.06, fill: { color: g.main ? ACCENT : PRIMARY }, line: { type: "none" } });
  s.addText(g.main ? "메인 게임" : "토너먼트", { x: 9.0, y: 0.3, w: 1.5, h: 0.4, fontFace: F, fontSize: 12, bold: true, color: g.main ? "5b4200" : WHITE, align: "center", valign: "middle", margin: 0 });
  if (g.dur) s.addText(g.dur, { x: 10.6, y: 0.3, w: 2.24, h: 0.4, fontFace: F, fontSize: 12, color: MUTED, align: "right", valign: "middle", margin: 0 });

  s.addText("진행 방식", { x: M, y: 1.22, w: 5, h: 0.3, fontFace: F, fontSize: 14, bold: true, color: PRIMARY, margin: 0 });
  const bu = () => ({ code: "2013", indent: 10 });
  s.addText(g.rules.map((r) => ({ text: r, options: { fontSize: 13, color: TEXT, breakLine: true, bullet: bu() } })),
    { x: M + 0.05, y: 1.56, w: 7.1, h: 2.8, fontFace: F, margin: 0, paraSpaceAfter: 8, valign: "top" });

  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 7.9, y: 1.22, w: 4.93, h: 1.5, rectRadius: 0.07, fill: { color: g.main ? WARNBG : PTINT }, line: { type: "none" } });
  const scoreRuns = [
    { text: g.main ? "점수 (메인 ×1.5)" : "점수 (토너먼트 공통)", options: { fontSize: 12.5, bold: true, color: g.main ? WARN : PRIMARY, breakLine: true } },
    { text: g.main ? "150 · 120 · 90 · 60 · 30 · 15" : "100 · 80 · 60 · 40 · 20 · 10", options: { fontSize: 20, bold: true, color: TEXT, breakLine: true } },
  ];
  if (g.special) scoreRuns.push({ text: g.special, options: { fontSize: 12, bold: true, color: WARN } });
  s.addText(scoreRuns, { x: 8.15, y: 1.35, w: 4.5, h: 1.25, fontFace: F, margin: 0, paraSpaceAfter: 4 });

  s.addText("심판 배정", { x: 7.9, y: 2.92, w: 4, h: 0.3, fontFace: F, fontSize: 14, bold: true, color: PRIMARY, margin: 0 });
  s.addText(g.assign.map((a) => ({ text: a, options: { fontSize: 12.5, color: TEXT, breakLine: true } })),
    { x: 7.9, y: 3.24, w: 4.95, h: 2.2, fontFace: F, margin: 0, paraSpaceAfter: 5, valign: "top" });

  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y: 4.62, w: 7.15, h: 1.95, rectRadius: 0.07, fill: { color: PTINT2 }, line: { color: LINEC, width: 0.75 } });
  s.addText("판정 포인트", { x: 0.75, y: 4.76, w: 4, h: 0.3, fontFace: F, fontSize: 12.5, bold: true, color: PRIMARY, margin: 0 });
  s.addText(g.judge.map((t) => ({ text: t, options: { fontSize: 12, color: TEXT, breakLine: true, bullet: bu() } })),
    { x: 0.78, y: 5.08, w: 6.7, h: 1.4, fontFace: F, margin: 0, paraSpaceAfter: 5 });
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 7.9, y: 5.62, w: 4.93, h: 0.95, rectRadius: 0.07, fill: { color: WHITE }, line: { color: LINEC, width: 0.75 } });
  s.addText([
    { text: "준비물  ", options: { fontSize: 12, bold: true, color: PRIMARY } },
    { text: g.items, options: { fontSize: 11.5, color: TEXT } },
  ], { x: 8.1, y: 5.72, w: 4.6, h: 0.75, fontFace: F, margin: 0, lineSpacingMultiple: 1.1 });

  if (g.warn) {
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 7.9, y: 4.62, w: 4.93, h: 0.88, rectRadius: 0.07, fill: { color: WARNBG }, line: { color: ACCENT, width: 1 } });
    s.addText([{ text: "⚠ 확인  ", options: { fontSize: 12, bold: true, color: WARN } }, { text: g.warn, options: { fontSize: 11.5, color: TEXT } }],
      { x: 8.1, y: 4.7, w: 4.6, h: 0.72, fontFace: F, margin: 0, lineSpacingMultiple: 1.1 });
  }
  srcNote(s, "규칙 원문: '스포츠데이 컨텐츠팀.docx' 발췌 · 배정: 인원관리표 · " + R.COMMON_FOOTER);
  s.addNotes(g.note || "");
}
for (const g of R.GAMES) refereeCard(g);

// =========================================================
// F5 — 결정 6가지
// =========================================================
(() => {
  const s = slideBase();
  header(s, "DECISIONS", "오늘 이 자리에서 정하는 6가지");
  const items = [
    { n: "①", t: "버스 대수", a: "마스터 지침 2대(80명)", b: "예산안 편도 3대(105만)", q: "몇 대가 진본? + 귀환 셔틀은?" },
    { n: "②", t: "단체티 수량·단가", a: "주문 기록 203장 @9,460", b: "예산안 217장 @15,200", q: "최종 발주 기준 하나로" },
    { n: "③", t: "하클 참석 인원", a: "개요 53명", b: "예산안(점심·티) 47명", q: "최종 인원 → 수량 기준" },
    { n: "④", t: "심판 인원 충원", a: "색판 보조 4 필요 → 배정 3", b: "계주 심판 4 필요 → 배정 3", q: "누가 추가로 들어가나?" },
    { n: "⑤", t: "중복 배정 조정", a: "촬영(유주영·최준혁) × 제기차기·피구 보조심판", b: "2부 도장/뽑기 = 메이플 지원 3명 (출석 미정)", q: "촬영 유연운영 or 대체자? + 메이플 출석 확인" },
    { n: "⑥", t: "우천 전환 기준", a: "수성관 — 시점·기준·결정자", b: "9/19 저녁 1차 + 당일 아침 최종(안)", q: "기준·결정자 오늘 확정" },
  ];
  items.forEach((it, i) => {
    const x = M + (i % 3) * 4.18, y = 1.5 + Math.floor(i / 3) * 2.72;
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y, w: 3.9, h: 2.52, rectRadius: 0.07, fill: { color: WHITE }, line: { color: LINEC, width: 0.75 }, shadow: softShadow() });
    s.addText([
      { text: it.n + " ", options: { fontSize: 20, bold: true, color: ACCENT } },
      { text: it.t, options: { fontSize: 16.5, bold: true, color: TEXT } },
    ], { x: x + 0.22, y: y + 0.14, w: 3.5, h: 0.42, fontFace: F, margin: 0 });
    s.addText(it.a, { x: x + 0.22, y: y + 0.62, w: 3.5, h: 0.56, fontFace: F, fontSize: 12, color: MUTED, margin: 0, lineSpacingMultiple: 1.05 });
    s.addText(it.b, { x: x + 0.22, y: y + 1.18, w: 3.5, h: 0.56, fontFace: F, fontSize: 12, color: MUTED, margin: 0, lineSpacingMultiple: 1.05 });
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: x + 0.22, y: y + 1.86, w: 3.46, h: 0.5, rectRadius: 0.05, fill: { color: PTINT }, line: { type: "none" } });
    s.addText(it.q, { x: x + 0.32, y: y + 1.86, w: 3.3, h: 0.5, fontFace: F, fontSize: 11.5, bold: true, color: PRIMARY, valign: "middle", margin: 0 });
  });
  s.addNotes("[10분·핵심] 카드 하나당 1~2분. 결정 즉시 기록 → 오늘 안에 마스터 지침·예산안 반영. ①~③ 문서 불일치, ④⑤ 인원관리표 대조 발견, ⑥ 미정 상태.");
})();

// =========================================================
// F6 — 클로징
// =========================================================
(() => {
  const s = p.addSlide();
  s.background = { color: DARK };
  s.addText("D-2", { x: 0.9, y: 1.1, w: 4.2, h: 1.7, fontFace: F, fontSize: 92, bold: true, color: ACCENT, margin: 0 });
  s.addText([
    { text: "결정은 오늘 · 점검은 내일 · 축제는 모레", options: { fontSize: 25, bold: true, color: WHITE, breakLine: true } },
    { text: "HI-Side Out · 2026. 9. 20 (일) 율전 대운동장", options: { fontSize: 13.5, color: "C9C4E8" } },
  ], { x: 0.95, y: 2.95, w: 8.5, h: 1.1, fontFace: F, margin: 0, paraSpaceAfter: 8 });
  ["F2C14E","4C9BE8","E5533D","63B063","9B7BD4","F28C3D"].forEach((c, i) => {
    s.addShape(p.shapes.OVAL, { x: 0.97 + i * 0.26, y: 4.35, w: 0.15, h: 0.15, fill: { color: c }, line: { type: "none" } });
  });
  s.addText("내일 9/19 (토)까지", { x: 7.6, y: 1.35, w: 4.8, h: 0.4, fontFace: F, fontSize: 15, bold: true, color: ACCENT, margin: 0 });
  const tasks = [
    "물품 도착 전수 확인 (쿠팡·게임연구소·국제처)",
    "심판 배정표·배치표 정보방 최종 공지",
    "버스 분할 명단·대기 프로그램 확정",
    "현장 사전 점검 · 우천 1차 판단",
  ];
  tasks.forEach((t, i) => {
    const y = 1.9 + i * 0.82;
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 7.6, y, w: 5.2, h: 0.66, rectRadius: 0.06, fill: { color: DARK2 }, line: { color: "4A4480", width: 0.75 } });
    s.addText(t, { x: 7.85, y, w: 4.9, h: 0.66, fontFace: F, fontSize: 12.5, color: WHITE, valign: "middle", margin: 0 });
  });
  s.addText("오늘 밤: 웹앱 미체크 항목 정리 + 결정 6건 문서 반영 · 발표 자료는 정보방 PNG로 공유됩니다", { x: 0.9, y: 5.35, w: 6.4, h: 0.7, fontFace: F, fontSize: 12.5, color: "C9C4E8", margin: 0, lineSpacingMultiple: 1.15 });
  s.addText("26-2 스포츠데이 기획팀 · 2026-09-18 최종 브리핑", { x: 0.9, y: 6.7, w: 8, h: 0.3, fontFace: F, fontSize: 11, color: "8F89B8", margin: 0 });
  s.addNotes("[2분] 마무리: 9/19 체크 4가지 읽고 — '내일은 현장, 모레는 축제'로 끝. 질문 받기.");
})();

p.writeFile({ fileName: OUT }).then(() => console.log("WROTE", OUT));
