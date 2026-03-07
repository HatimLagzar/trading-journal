import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Live trades',
}

export default function TradesLayout({ children }: { children: React.ReactNode }) {
  return children
}
