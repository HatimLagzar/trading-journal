import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import DashboardRouteLoading from '@/app/components/DashboardRouteLoading'
import TradesClient from './TradesClient'
import { createClient } from '@/lib/supabase/server'

export default async function TradesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<DashboardRouteLoading variant="trades" />}>
      <TradesClient initialUserId={user.id} />
    </Suspense>
  )
}
