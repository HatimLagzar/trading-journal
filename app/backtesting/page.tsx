import { redirect } from 'next/navigation'
import BacktestingClient from './BacktestingClient'
import { createClient } from '@/lib/supabase/server'
import type { BacktestingSession, BacktestingTrade } from '@/services/backtesting'
import type { System } from '@/services/system'

export default async function BacktestingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: systems, error: systemsError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from('systems').select('*').eq('user_id', user.id).order('name', { ascending: true }),
    supabase.from('backtesting_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  const defaultSessionId = sessions?.[0]?.id ?? null
  const { data: trades, error: tradesError } = defaultSessionId
    ? await supabase
        .from('backtesting_trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', defaultSessionId)
        .order('created_at', { ascending: false })
    : { data: [], error: null }

  const initialError = systemsError?.message ?? sessionsError?.message ?? tradesError?.message ?? null

  return (
    <BacktestingClient
      initialUserId={user.id}
      initialSystems={(systems ?? []) as System[]}
      initialSessions={(sessions ?? []) as BacktestingSession[]}
      initialSelectedSessionId={defaultSessionId}
      initialTrades={(trades ?? []) as BacktestingTrade[]}
      initialError={initialError}
    />
  )
}
