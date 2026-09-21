import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import {
  EVENT_DATE_ISO,
  EVENT_NAME,
  HUB_TITLE,
  SEMESTER_LABEL,
} from '@/lib/event-config'
import { daysUntil, eventDateLabel } from '@/lib/dday'

/**
 * 연도 설정 로딩 계층 (서버 전용).
 *
 * 원천은 DB의 app_config 키-값 테이블이고, lib/event-config.ts 의 상수는
 * DB가 비어 있거나 읽기에 실패했을 때의 폴백(템플릿 기본값)이다.
 * 값은 시즌 리셋 SQL(AI-SEASON-RESET.md 절차)로 UPSERT 된다 —
 * 코드 수정·재배포 없이 앱에 올해 값이 반영된다.
 *
 * 사용처: app/layout.tsx(generateMetadata), components/layout/sidebar.tsx,
 * app/page.tsx, app/my-role/page.tsx. 클라이언트 컴포넌트에는 props로 전달한다.
 */
export interface EventConfig {
  hubTitle: string
  eventName: string
  semesterLabel: string
  eventDateIso: string
  /** 파생값 — "2026. 9. 20 (일)" 표기 */
  eventDateLabel: string
  /** 파생값 — D-day (당일 0) */
  daysUntil: number
  /** 파생값 — 'YYYY' (문서 파싱·정렬용) */
  eventYear: string
}

/** app_config 키 목록 — 키가 늘면 event-config.ts 폴백도 함께. */
type ConfigKey =
  | 'hub_title'
  | 'event_name'
  | 'semester_label'
  | 'event_date_iso'

/** 폴백 기본값 (event-config.ts) */
export const FALLBACK_CONFIG: Record<ConfigKey, string> = {
  hub_title: HUB_TITLE,
  event_name: EVENT_NAME,
  semester_label: SEMESTER_LABEL,
  event_date_iso: EVENT_DATE_ISO,
}

/**
 * DB 행 + 폴백 병합 — 순수 함수 (단위테스트 대상).
 * DB 값은 빈 문자열이면 무시(폴백 사용). 날짜 형식이 어긋나면 폴백.
 */
export function mergeConfig(
  rows: { key: string; value: string }[]
): EventConfig {
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const pick = (key: ConfigKey): string => {
    const v = map.get(key)?.trim()
    if (!v) return FALLBACK_CONFIG[key]
    if (key === 'event_date_iso' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return FALLBACK_CONFIG[key]
    }
    return v
  }
  const eventDateIso = pick('event_date_iso')
  return {
    hubTitle: pick('hub_title'),
    eventName: pick('event_name'),
    semesterLabel: pick('semester_label'),
    eventDateIso,
    eventDateLabel: eventDateLabel(eventDateIso),
    daysUntil: daysUntil(eventDateIso),
    eventYear: eventDateIso.slice(0, 4),
  }
}

/**
 * 요청 범위 캐시된 설정 로드. app_config 테이블 부재(마이그레이션 전 배포 등)나
 * 조회 오류는 폴백으로 조용히 처리 — 페이지 전체가 죽지 않게(스펙 §7 관례).
 */
export const getEventConfig = cache(async (): Promise<EventConfig> => {
  let rows: { key: string; value: string }[] = []
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_config')
      .select('key,value')
    if (!error && data) rows = data
  } catch {
    // 테이블 없음 등 — 폴백 사용
  }
  return mergeConfig(rows)
})
