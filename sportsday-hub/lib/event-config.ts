/**
 * ═══════════════════════════════════════════════════════════════════
 *  ⚙️ 행사 설정 — 새 시즌마다 이 파일만 수정하세요
 * ═══════════════════════════════════════════════════════════════════
 *  대시보드 제목 · D-데이 · 팀 목록/색상 · 마크다운 파서 · 시드 스크립트가
 *  모두 이 파일을 단일 원천으로 참조합니다. 원칙적으로 다른 코드 파일은
 *  건드리지 않아도 새 시즌을 준비할 수 있습니다.
 *
 *  수정했으면 반드시 검증:  npm run typecheck && npm test
 *  전체 작업 절차 안내:      ../../HANDOVER/02_콘텐츠_채우기.md
 *
 *  26-2(2026-2학기) 실제 사용례는 git 태그 final-2026-2 확인
 *  (당시에는 이 정보가 여러 파일에 분산되어 있었습니다).
 */

// ── 행사 기본 정보 ─────────────────────────────────────────────────

/** 허브의 큰 제목 — 대시보드 상단·브라우저 탭에 표시 */
export const HUB_TITLE = '스포츠데이 허브'

/** 행사명 — 부제·메타 정보에 표기 (예: '26-2 스포츠데이') */
export const EVENT_NAME = '27-1 스포츠데이'

/** 학기 표기 (예: '2026년 2학기') */
export const SEMESTER_LABEL = '2027년 1학기'

/**
 * 행사일 (현지 기준 'YYYY-MM-DD').
 * D-데이 계산·사이드바 표기·당일 페이지(/my-role) 진행 상태 판정의 원천.
 */
export const EVENT_DATE_ISO = '2027-03-20'

/** 문서 파서용 연도 — EVENT_DATE_ISO에서 자동 추출되므로 직접 고칠 필요 없음 */
export const EVENT_YEAR: string = EVENT_DATE_ISO.slice(0, 4)

// ── 팀 구성 ────────────────────────────────────────────────────────

/** 팀 id 목록 — DB teams 테이블의 id와 정확히 일치해야 합니다 */
export const TEAM_IDS = [
  'management',
  'content',
  'budget',
  'exchange',
  'timeline',
] as const
export type TeamId = (typeof TEAM_IDS)[number]

/**
 * 팀 표시 정보 — npm run migrate:md 시드 생성에도 사용된다.
 * color는 hex, icon은 lucide 아이콘명(파스칼케이스).
 */
export const TEAM_META: Record<
  TeamId,
  { name: string; name_en: string; color: string; icon: string; mission: string }
> = {
  management: {
    name: '기획관리팀',
    name_en: 'Management',
    color: '#6366f1', // indigo
    icon: 'Settings',
    mission: '전체 총괄, 진행상황 업데이트, 팀 간 조율',
  },
  content: {
    name: '컨텐츠팀',
    name_en: 'Content',
    color: '#ec4899', // pink
    icon: 'Gamepad2',
    mission: '게임 구성·규칙, 배치도, 필요 인원/물품',
  },
  budget: {
    name: '예산팀',
    name_en: 'Budget',
    color: '#10b981', // emerald
    icon: 'Wallet',
    mission: '예산안, 입장료, 식사, 단체티, 준비물 리스트',
  },
  exchange: {
    name: '교환담당팀',
    name_en: 'Exchange',
    color: '#f59e0b', // amber
    icon: 'Users',
    mission: '구글폼, 참여자 명단, 교환 팀 배정, 카드뉴스 인계물',
  },
  timeline: {
    name: '타임라인/인원관리팀',
    name_en: 'Timeline',
    color: '#06b6d4', // cyan
    icon: 'CalendarClock',
    mission: '전체 타임라인, 하클 인원 배치, 명륜 버스 운영',
  },
}

/** 팀 표시 순서 (대시보드 카드·사이드바 정렬) */
export const TEAM_ORDER: readonly TeamId[] = TEAM_IDS

/**
 * 기획 문서(마크다운)에 등장하는 팀 표기 → 팀 id 매핑.
 * 문서에서 쓰는 팀 이름을 바꾸면 여기에도 반영해야 파서가 인식한다.
 */
export const TEAM_KEYWORDS: Record<string, TeamId> = {
  컨텐츠: 'content',
  콘텐츠: 'content',
  예산: 'budget',
  교환: 'exchange',
  타임라인: 'timeline',
  기획관리: 'management',
  기획: 'management',
  전체: 'management',
}
