import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { DdayBadge } from './dday-badge'
import { getTeams } from '@/lib/queries/teams'

export async function SidebarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const teams = await getTeams()
  return (
    <SidebarProvider>
      <AppSidebar teams={teams} />
      <SidebarInset>
        <header className="sticky top-0 z-40 bg-background flex h-14 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          {/* 모바일에서는 사이드바가 접히므로 D-day를 헤더에 상시 노출 */}
          <div className="ml-auto">
            <DdayBadge />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
