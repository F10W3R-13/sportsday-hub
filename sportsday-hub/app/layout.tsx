import type { Metadata } from 'next'
import { Inter, Noto_Sans_KR } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { SidebarLayout } from '@/components/layout/sidebar'
import { NicknameProvider } from '@/components/layout/nickname-provider'
import { DemoBanner } from '@/components/demo-banner'
import { getEventConfig } from '@/lib/config'

// 라틴은 Inter, 한글은 Noto Sans KR로 해결하는 폰트 스택 (globals.css --font-sans 참조)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})
const notoSansKr = Noto_Sans_KR({
  // 한글 글리프는 unicode-range 분할로 자동 로드되므로 latin만 프리로드 지정
  subsets: ['latin'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
})

// 연도 값은 DB(app_config)에서 — 비어 있으면 event-config.ts 폴백
export async function generateMetadata(): Promise<Metadata> {
  const config = await getEventConfig()
  return {
    title: `${config.hubTitle} — ${config.eventName}`,
    description: `${config.eventName} 기획팀 협업 허브`,
  }
}

// 첫 페인트 전에 다크 클래스 적용 — 테마 깜빡임(FOUC) 방지
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansKr.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <DemoBanner />
        <Providers>
          <NicknameProvider>
            <SidebarLayout>{children}</SidebarLayout>
          </NicknameProvider>
        </Providers>
      </body>
    </html>
  )
}
