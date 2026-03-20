import { redirect } from 'next/navigation'
import TradesClient from './TradesClient'
import { createClient } from '@/lib/supabase/server'
import type { Trade } from '@/services/trade'
import type { SubSystem, System } from '@/services/system'

export default async function TradesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: trades, error: tradesError }, { data: systems, error: systemsError }, { data: subSystems, error: subSystemsError }] = await Promise.all([
    supabase.from('trades').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('systems').select('*').eq('user_id', user.id).order('name', { ascending: true }),
    supabase.from('sub_systems').select('*').eq('user_id', user.id).order('name', { ascending: true }),
  ])

  const initialError = tradesError?.message ?? systemsError?.message ?? subSystemsError?.message ?? null

  return (
    <TradesClient
      initialUserId={user.id}
      initialTrades={(trades ?? []) as Trade[]}
      initialSystems={(systems ?? []) as System[]}
      initialSubSystems={(subSystems ?? []) as SubSystem[]}
      initialError={initialError}
    />
  )
}
