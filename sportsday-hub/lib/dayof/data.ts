// lib/dayof/data.ts — 스포츠데이 당일 배치·게임·명단 데이터 (템플릿 예시 데이터).
//
// ▶ 새 시즌 작성법 (자세히: ../../../HANDOVER/03_당일역할_페이지.md)
//   1) 이 파일의 값들을 올해 명단·배치로 교체한다. export 이름과 자료 구조는 그대로.
//   2) 브리핑 자료도 만든다면 briefing-build/roster.js 에도 같은 내용을 반영한다
//      (roster.js가 덱·보드 제작의 원천 — 두 파일은 수동 동기화).
//   3) 아래 규칙을 지켜야 /my-role 페이지가 정확히 동작한다:
//      · 배치 텍스트(GATHER·MORNING·LUNCH·AFTERNOON·FLOW·GAMES.assign)에 등장하는
//        모든 이름은 반드시 ROSTER_NAMES 안에 있을 것 (npm test 가 검증한다).
//      · GAMES[].assign 은 "역할 — 이름 · 이름" 형식으로 쓴다 (schedule.ts 파싱 규칙).
//      · 게임 idx는 1부터 순서대로.
//   4) 검증: npm test  →  dayof-* 구조 검증이 전부 통과하면 OK.
//
// ▶ 작년(26-2) 실제 데이터의 완성형 예시: archive/2026-2/my-role-data/data.ts
//   (54인 명단·게임 6종·입장 플로우 등 — 구조 파악용 참고본)

export type SlotCell = { role: string; n: number; lead?: string; members?: string[] }

export type SlotRow =
  | { k: 'H'; l: SlotCell; r: SlotCell | null }
  | { k: 'F'; role: string; n: number; lead: string; members?: string[] }
  | { k: 'N'; text: string }

export type TimeSlot = { time: string; label?: string; rows: SlotRow[] }

export type AfternoonSlot = { time: string; rows: string[] }

export type FlowStep = { t: string; d: string; n: string }

export type GatherGroup = { title: string; chip: string; who: string; rows: { t: string; d: string; n: string }[] }

export type Game = {
  idx: number
  name: string
  /** 오후 배치(AFTERNOON) 텍스트에서 이 게임 행을 찾는 짧은 별칭. 없으면 name으로 매칭. */
  alias?: string
  time: string
  dur: string
  main: boolean
  rules: string[]
  special?: string
  assign: string[]
  judge: string[]
  items: string
  warn?: string
  note: string
}

// ── 공통 명단 ──
// 아래는 "예시용 가상 인물" 12명이다. 실제 명단으로 전부 교체할 것.
// (export 이름 MR6·MAPLE6 등은 26-2 당시 인원수에서 유래 — 인원 수와 무관하게 유지)
export const MR6 = ['윤서준', '임하은', '한지민'] // 캠퍼스A 파트 (명륜 등 다른 캠퍼스 담당)
export const TEAMLEADS = ['박민수', '최지우', '정다은'] // 팀장
export const VICELEADS = ['강도윤', '오세훈'] // 부팀장
export const JUKSIK = ['한지민', '남주혁'] // 점수 집계
export const MC = ['김철수', '이영희'] // 사회
export const MAPLE6 = ['윤서준', '임하은', '남주혁'] // 타학교 지원 인원 (있다면)

export const COMMON_FOOTER =
  '공통 — 사회 김철수 · 이영희  |  교환 인솔은 팀장  |  경기 종료 후 점수는 집계 담당(한지민 · 남주혁)에게'

// 게임 1부·2부 헤더 메모 — 배정이 없는 인원의 기본 동작.
export const NOTE_GAME_JOIN = '게임 1부·2부 — 업무가 없는 인원은 소속 팀과 함께 게임에 참여'

// 당일 배치에 등장하는 전원. 가나다순으로 자동 정렬된다.
export const ROSTER_NAMES: string[] = [
  '김철수', '이영희', '박민수', '최지우', '정다은', '강도윤',
  '윤서준', '임하은', '한지민', '조현우', '오세훈', '남주혁',
].sort((a, b) => a.localeCompare(b, 'ko'))

// ── 자료 0 · 아침 집합 ──
// 캠퍼스가 1개뿐이면 myeongryun/yuljeon 중 하나만 쓰고 나머지는 빈 rows 로 두어도 된다.
export const GATHER = {
  myeongryun: {
    title: '캠퍼스A조 — 버스 탑승',
    chip: '09:30 · 캠퍼스A 정문',
    who: '대상 — 캠퍼스A 소속 인원 + 캠퍼스A 소속 교환학생',
    rows: [
      { t: '09:30~10:00', d: '출석 체크 · 버스 탑승 수속', n: '윤서준 · 임하은' },
      { t: '09:30~10:00', d: '물품 상차', n: '한지민' },
      { t: '10:00~10:30', d: '탑승 안내 · 출발', n: '남주혁' },
    ],
  },
  yuljeon: {
    title: '본캠퍼스조 — 현장 직행',
    chip: '10:00 · 본캠퍼스 현장',
    who: '대상 — 본캠퍼스 소속 인원 · 교환학생 입장은 수속(자료 2)에서 합류',
    rows: [
      { t: '10:00~10:30', d: '대여물품 수령 · 출석 체크', n: '박민수 · 이영희' },
      { t: '10:30~11:50', d: '경기장 준비 (입장 관리존 최우선)', n: '준비조 — 아래 배치 표' },
    ],
  },
  chips: [
    ['09:30', '캠퍼스A 정문 집합·출석'],
    ['10:00~10:30', '버스 출발 / 본캠퍼스조 출석'],
    ['11:50', '입장 수속 — 전원'],
    ['13:00', '개회'],
  ],
  wait: '버스 도착 후 입장 수속까지 대기 — 대기 프로그램은 전날 공지',
  weather: '우천 시에도 집합 시각·장소 동일 — 현장 운영은 우천 전환 공지 따름',
  note: "'아침에 어디로 가냐'가 첫 안건. 캠퍼스A 소속은 9:30 정문, 본캠퍼스 소속은 10:00 현장 출석.",
}

// ── 자료 1 · 오전 배치 (members = 조 전원, 조장이 첫 번째) ──
// k:'H' = 두 칸짜리 행(l=왼쪽, r=오른쪽·없으면 null) / k:'F' = 한 칸짜리 행 / k:'N' = 안내 문구
export const MORNING: TimeSlot[] = [
  { time: '09:20~09:30', label: '집합 (캠퍼스A)', rows: [
    { k: 'F', role: '출석 체크', n: 1, lead: '윤서준', members: ['윤서준'] },
  ]},
  { time: '10:00~10:30', label: '버스 출발 / 현장 준비', rows: [
    { k: 'H', l: { role: '버스 탑승 안내', n: 2, lead: '남주혁', members: ['남주혁', '윤서준'] }, r: { role: '현장 출석체크', n: 2, lead: '박민수', members: ['박민수', '이영희'] } },
    { k: 'F', role: '물품 이동', n: 3, lead: '강도윤', members: ['강도윤', '조현우', '오세훈'] },
    { k: 'F', role: '얼음 구매 (마트)', n: 2, lead: '정다은', members: ['정다은', '최지우'] },
  ]},
  { time: '10:30~11:50', label: '경기장 준비', rows: [
    { k: 'F', role: '입장 관리존 설치 (최우선)', n: 3, lead: '강도윤', members: ['강도윤', '조현우', '임하은'] },
    { k: 'F', role: '팀별 대기존 설치 (천막·돗자리)', n: 3, lead: '오세훈', members: ['오세훈', '윤서준', '한지민'] },
    { k: 'H', l: { role: '본부 설치', n: 2, lead: '박민수', members: ['박민수', '이영희'] }, r: null },
    { k: 'N', text: '그 외 전원 — 준비 총괄의 지시에 따라 현장 지원' },
  ]},
]

export const LUNCH: TimeSlot[] = [
  { time: '11:50~12:50', label: '입장·점심·단체티', rows: [
    { k: 'F', role: '입장 인솔 (버스 도착 즉시)', n: 3, lead: '윤서준', members: ['윤서준', '임하은', '한지민'] },
    { k: 'H', l: { role: '인원 체크 (노트북)', n: 2, lead: '한지민', members: ['한지민', '남주혁'] }, r: { role: '도장판 작성', n: 2, lead: '이영희', members: ['이영희', '최지우'] } },
    { k: 'F', role: '팀별 단체티 배부 (부팀장, 도장판 기준)', n: 3, lead: '강도윤', members: ['강도윤', '조현우', '오세훈'] },
    { k: 'N', text: '그 외 전원 — 본인 팀 천막 대기 · 팀장은 반드시 천막에서 교환과 함께' },
  ]},
  { time: '12:50~13:00', label: '개막 전 선수 입장', rows: [
    { k: 'F', role: '팀별 소집 — 팀장 · 부팀장', n: 6, lead: '박민수 외 팀장', members: ['박민수', '강도윤', '최지우', '조현우', '정다은', '오세훈'] },
  ]},
]

// ── 오후 배치 (자유 텍스트 — ' · ' 로 항목을 나눠 쓴다) ──
export const AFTERNOON: AfternoonSlot[] = [
  { time: '13:00~13:30', rows: [
    '사회 ×2 김철수·이영희',
    '팀별 인솔 — 팀장 · 상세 = 자료 2 플로우',
  ]},
  { time: '13:30~15:15', rows: [
    '상시 — 점수 집계(노트북) 한지민·남주혁 · 도장/뽑기 임하은·최지우',
    '게임 A 13:30~14:10 — 주심 강도윤 · 상세 → 카드 1',
    '게임 B 14:10~14:50 — 주심 조현우 · 상세 → 카드 2',
    '15:10~15:45 중간 — 점수 중간점검 한지민·남주혁',
  ]},
  { time: '15:50~17:35', rows: [
    '상시 — 점수 집계 한지민·남주혁',
    '계주(게임 B) 17:10~17:35 — 주심 오세훈 · 상세 → 카드 2',
  ]},
  { time: '18:00~', rows: [
    '뒷정리 다 같이 — 설치자가 철거: 천막 원복 · 대여물품 반납',
  ]},
]

// ── 자료 2 · 입장 수속 플로우 ──
export const FLOW: FlowStep[] = [
  { t: '버스 도착 · 인솔', d: '도착 즉시 인솔\n수속장 도착 공지', n: '윤서준 임하은 한지민 (3)' },
  { t: '출석 체크', d: '교환 명단 대조\n노트북 지참', n: '한지민 남주혁 (2)' },
  { t: '도장판 기록', d: '팀 · 티셔츠 사이즈', n: '이영희 최지우 (2)' },
  { t: '점심 · 음료 배부', d: '점심 + 물\n줄 관리 병행', n: '정다은 강도윤 (2)' },
  { t: '팀 천막 안내', d: '천막별 · 돗자리', n: '팀장 — 박민수 최지우 정다은' },
  { t: '단체티 배부', d: '도장판 기준 교환\n사이즈 불일치 즉시 보고', n: '부팀장 — 강도윤 조현우 오세훈' },
]

// ── 자료 3 · 심판 카드 ──
export const GAMES: Game[] = [
  {
    idx: 1, name: '게임 A (예시)', alias: '게임 A', time: '13:30 ~ 14:10', dur: '경기당 3분 + 준비 5분', main: false,
    rules: [
      '규칙 1 — 팀당 출전 인원과 대진 방식',
      '규칙 2 — 승리 조건',
      '규칙 3 — 무승부 방지 장치',
    ],
    assign: ['주심 — 강도윤', '보조심판 — 윤서준', '게임 보조 — 임하은 · 최지우', '부스·현장 관리 — 정다은'],
    judge: [
      '주심: 시작·종료 신호, 반칙 판정',
      '보조심판: 세부 판정 보조',
      '보조: 물품 세팅·정리',
    ],
    items: '호루라기 · 기타 게임 물품',
    warn: '원문 요구 인원 보조 4명 → 배정 3명 (1명 부족)',
    note: '대진 추첨은 개회 직후 확정.',
  },
  {
    idx: 2, name: '게임 B (예시·메인)', alias: '게임 B', time: '14:10 ~ 14:50', dur: '단판 20분', main: true,
    rules: [
      '규칙 1 — 전원 참여 여부',
      '규칙 2 — 진행 방식',
      '규칙 3 — 점수 산정 (메인 게임 배점 주의)',
    ],
    special: '메인 게임 배점 안내',
    assign: ['주심 — 조현우', '보조 — 오세훈 · 남주혁', '게임 보조(지원) — 윤서준 · 임하은', '부스·현장 관리 — 한지민'],
    judge: [
      '주심: 진행 전반',
      '보조: 참가자 안내',
    ],
    items: '마이크 · 호루라기 · 기타',
    note: '메인 게임은 배점이 높다 — 판정 기준을 시작 전에 명시.',
  },
]

// ── 자료 3-0 · ⚔ 배정 주의 (인원 부족·역할 겹침 등 현장 리스크) ──
export const WARN4: string[] = [
  '게임 A — 보조 4명 필요, 배정 3명',
  '촬영(12:00~18:00) — 이영희 부스 운영과 겹침',
]
