import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Backtesting',
}

export default function BacktestingLayout({ children }: { children: React.ReactNode }) {
  return children
}
