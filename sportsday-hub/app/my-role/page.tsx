import { MyRoleClient } from '@/components/my-role/my-role-client'
import { COMMON_FOOTER, GATHER } from '@/lib/dayof/data'

export default function MyRolePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">내 역할</h1>
        <p className="text-sm text-muted-foreground">
          스포츠데이 당일 — 이름을 선택하면 담당 역할과 일정이 시간순으로 표시됩니다
        </p>
      </div>
      <MyRoleClient />
      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="font-semibold">당일 공통 안내 (전원)</h2>
        <ul className="space-y-1 text-sm">
          {GATHER.chips.map(([t, d]) => (
            <li key={t}>
              <span className="font-mono text-muted-foreground">{t}</span> — {d}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{GATHER.wait}</p>
        <p className="text-sm text-muted-foreground">{GATHER.weather}</p>
        <p className="text-sm text-muted-foreground">{COMMON_FOOTER}</p>
      </section>
    </div>
  )
}
