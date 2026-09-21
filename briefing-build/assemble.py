import io, sys

SRC = "briefing_deck.js"

with io.open(SRC, encoding="utf-8") as f:
    lines = f.read().split("\n")

# 라인 찾기: 마커 주석 바로 위의 '// ====...' 헤더 라인 인덱스
def header_of(marker):
    for i, l in enumerate(lines):
        if l.startswith(marker):
            return i - 1
    raise SystemExit("marker not found: " + marker)

iA = header_of("// S1 — 자료 1-A")
i1C = header_of("// S3 — 자료 1-C")
iFlow = header_of("// S4 — 자료 2")
iCards = header_of("// S5~S10")
iCommon = header_of("// S11 — 자료 3-0")
iWrite = next(i for i, l in enumerate(lines) if l.startswith("p.writeFile"))

head = lines[:iA]
b_1A_1B = lines[iA:i1C]
b_1C = lines[i1C:iFlow]
b_flow = lines[iFlow:iCards]
b_cards = lines[iCards:iCommon]
b_common = lines[iCommon:iWrite]
tail = lines[iWrite:]

# 상수/OUT 치환 (head 안에서)
head = [l.replace('path.join(ROOT, "26-2 Sports Day", "현장 운영 보드.pptx")',
                  'path.join(ROOT, "26-2 Sports Day", "최종 브리핑 덱 (발표자용).pptx")')
         .replace('p.title = "HI-Side Out 현장 운영 보드";',
                  'p.title = "HI-Side Out 최종 브리핑 (2026-09-18)";') for l in head]
head.insert(9, 'const DARK = "26224A", DARK2 = "343060";')

FRAMING = r'''// =========================================================
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

'''

VENUE = r'''// =========================================================
// F4 — 배치도 (투사)
// =========================================================
(() => {
  const s = slideBase();
  header(s, "VENUE", "대운동장 배치도 — 설치 구역과 담당");
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.55, w: 8.3, h: 5.15, rectRadius: 0.07, fill: { color: WHITE }, line: { color: LINEC, width: 0.75 }, shadow: softShadow() });
  s.addImage({ path: path.join(ROOT, "_briefing_build", "배치도_26-2.png"), x: 0.75, y: 1.8, w: 7.8, h: 4.3, sizing: { type: "contain", w: 7.8, h: 4.3 } });
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

'''

DECISION = r'''// =========================================================
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
    { n: "⑤", t: "중복 배정 조정", a: "촬영(유주영·최준혁) × 부스·심판", b: "박서원·안령인 × 도장뽑기·병뚜껑", q: "촬영 유연운영 or 대체자?" },
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

'''

CLOSING = r'''// =========================================================
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

'''

out = (head + [FRAMING] + b_1A_1B + b_flow + b_1C + [VENUE] + b_common + b_cards +
       [DECISION] + [CLOSING] + tail)

with io.open(SRC, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(out))
print("assembled, lines:", len(out))
