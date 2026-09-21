const pptxgen = require("pptxgenjs");
const path = require("path");
const R = require("./roster.js");
const ROOT = "C:\\Users\\0616y\\OneDrive\\바탕 화면\\minwo0___\\26-2 스포츠데이기획";
const OUT = path.join(ROOT, "26-2 Sports Day", "현장 운영 보드.pptx");

// ===== 팔레트/공통 =====
const PRIMARY = "4B3FA6", PTINT = "ECEAF7", PTINT2 = "F7F6FB", ACCENT = "F5A623";
const TEXT = "1F2937", MUTED = "6B7280", LINEC = "E2E8F0", WHITE = "FFFFFF";
const WARN = "B45309", WARNBG = "FFF6E5";
const F = "Malgun Gothic";
const W = 13.33, H = 7.5, M = 0.5;
const softShadow = () => ({ type: "outer", color: "26224A", blur: 4, offset: 1, angle: 60, opacity: 0.10 });

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "스포츠데이 기획팀";
p.title = "HI-Side Out 현장 운영 보드";

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
// S1 — 자료 0 · 하클 최초 집합 (9/20 아침)
// =========================================================
(() => {
  const s = slideBase();
  header(s, "자료 0 · 최초 집합 안내", "하클 인원 최초 집합 — 9/20 (일) 아침", "명륜조 09:30 · 율전조 10:00");
  renderGather(s);
  srcNote(s, "출처: 최종기획안 '2. 타임라인 & 인원관리표' 9:30~10:30 · 버스 대수·탑승 명단은 브리핑 안건(결정 ①)");
  s.addNotes("하클 인원 이동 안건. 명륜 소속 9:30 국제관 L / 율전 소속 10:00 현장 출석. 탑승 명단은 브리핑에서 확정 후 오늘 밤 정보방 공지.");
})();

// =========================================================
// S2 — 자료 1-A · 오전 준비 (09:30~11:50)
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
// S3 — 자료 1-B · 입장·개회 (11:50~13:00)
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
    { text: "우천 시에도 절차 동일 — 수성관 내 입장 관리존", options: { fontSize: 12.5, color: TEXT, bullet: { code: "2013", indent: 10 } } },
  ], { x: 0.78, y: y + 0.28, w: 11.6, h: 1.4, fontFace: F, margin: 0, paraSpaceAfter: 6 });
  srcNote(s, "출처: 최종기획안 인원관리표 11:50~12:50 · 절차 상세(6단계 플로우)는 자료 2 슬라이드 참조");
  s.addNotes("입장 수속 명단 배치 버전. 절차 순서는 다음 장(자료 2) 플로우로 설명. 추가 접수 절차는 브리핑에서 결정.");
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
// S5 — 자료 2 · 입장 수속 플로우
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
// S12 — 자료 3-0 · 심판 공통
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
  s.addNotes("공통 카드로 시작해 전 심판이 배점을 동일하게 이해하게 한다. ⚠ 4건은 브리핑에서 자리에서 조정 결정.");
})();

p.writeFile({ fileName: OUT }).then(() => console.log("WROTE", OUT));
