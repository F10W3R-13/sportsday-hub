'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarClock,
  LayoutDashboard,
  Trash2,
  Circle,
  Settings,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import type { Team } from '@/lib/types/models'
import * as Icons from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'

type IconComponent = ComponentType<{ style?: CSSProperties; className?: string }>

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/timeline', label: '타임라인', icon: CalendarClock },
  { href: '/trash', label: '휴지통', icon: Trash2 },
  { href: '/settings', label: '설정', icon: Settings },
]

function getIcon(name: string): IconComponent {
  const registry = Icons as unknown as Record<string, IconComponent>
  return registry[name] ?? Circle
}

export function AppSidebar({ teams }: { teams: Team[] }) {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <div className="text-lg font-bold">HI-Side Out Hub</div>
        <div className="text-xs text-muted-foreground">
          2026. 9. 19 (토) · D-{daysUntil()}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>전체</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={
                      item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href)
                    }
                    render={
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>팀 워크스페이스</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {teams.map((team) => {
                const Icon = getIcon(team.icon)
                return (
                  <SidebarMenuItem key={team.id}>
                    <SidebarMenuButton
                      isActive={pathname === `/team/${team.id}`}
                      render={
                        <Link href={`/team/${team.id}`}>
                          <Icon style={{ color: team.color }} />
                          <span>{team.name}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

function daysUntil(): number {
  const event = new Date('2026-09-19')
  const now = new Date()
  return Math.max(
    0,
    Math.ceil((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  )
}
