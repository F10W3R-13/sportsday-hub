import { IS_DEMO } from '@/lib/demo'

// 데모 인스턴스 배너 — 운영 배포(IS_DEMO=false)에서는 렌더 자체가 생략된다.
// "가상 데이터 + 읽기 전용"임을 첫 화면에서 알려 실제 팀 운영 도구와 구분한다.
export function DemoBanner() {
  if (!IS_DEMO) return null
  return (
    <div
      role="note"
      aria-label="read-only demo notice"
      className="border-b border-amber-300/60 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-200"
    >
      📖 읽기 전용 데모 — 표시되는 데이터는 가상의 예시입니다. 실제 운영 도구가 아닙니다.
    </div>
  )
}
