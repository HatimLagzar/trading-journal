import { redirect } from 'next/navigation'

type PremiumPageProps = {
  searchParams: Promise<{
    feature?: string
    checkout?: string
  }>
}

export default async function PremiumPage({ searchParams }: PremiumPageProps) {
  const params = await searchParams
  const query = new URLSearchParams({ intent: 'premium' })

  if (params.feature) {
    query.set('feature', params.feature)
  }

  if (params.checkout) {
    query.set('checkout', params.checkout)
  }

  redirect(`/?${query.toString()}#pricing`)
}
