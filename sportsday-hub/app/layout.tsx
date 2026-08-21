import type { Metadata } from 'next'
import { Inter, Noto_Sans_KR } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { SidebarLayout } from '@/components/layout/sidebar'
import { NicknameProvider } from '@/components/layout/nickname-provider'

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

export const metadata: Metadata = {
  title: 'HI-Side Out Hub — 26-2 스포츠데이',
  description: '26-2 스포츠데이 기획팀 협업 허브',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansKr.variable}`}>
        <Providers>
          <NicknameProvider>
            <SidebarLayout>{children}</SidebarLayout>
          </NicknameProvider>
        </Providers>
      </body>
    </html>
  )
}
