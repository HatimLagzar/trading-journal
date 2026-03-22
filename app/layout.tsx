import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/AuthContext'
import { PremiumProvider } from '@/lib/PremiumContext'
import { ThemeProvider } from '@/lib/ThemeContext'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Trade In Systems',
    template: '%s | Trade In Systems',
  },
  metadataBase: new URL('https://tradeinsystems.com'),
  description: 'Trade In Systems helps traders journal trades, review decisions, track R-multiple performance, and run structured backtesting in one workflow.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: 'https://tradeinsystems.com',
    siteName: 'Trade In Systems',
    title: 'Trade In Systems',
    description: 'Journal live trades, backtest ideas, and review performance with a serious workflow built for traders.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Trade In Systems trading journal platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trade In Systems',
    description: 'Journal trades, track R-multiple performance, and backtest with one serious trading workflow.',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var theme=localStorage.getItem('app_theme_mode');if(theme==='dark'){document.documentElement.classList.add('app-dark-mode')}}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <PremiumProvider>
              {children}
            </PremiumProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
