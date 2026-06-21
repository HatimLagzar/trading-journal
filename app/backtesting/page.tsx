import { redirect } from 'next/navigation'
import BacktestingClient from './BacktestingClient'
import { createClient } from '@/lib/supabase/server'

export default async function BacktestingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <BacktestingClient initialUserId={user.id} />
}
