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
  description: 'Track, analyze, and improve your trading performance.',
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
