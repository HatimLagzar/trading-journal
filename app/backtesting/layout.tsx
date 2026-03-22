import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Backtesting',
  robots: {
    index: false,
    follow: false,
  },
}

export default function BacktestingLayout({ children }: { children: React.ReactNode }) {
  return children
}
