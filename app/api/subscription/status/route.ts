import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPremiumSubscription } from '@/lib/subscription'
import type { UserSubscription } from '@/services/subscription'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const subscription = (data ?? null) as UserSubscription | null

    return NextResponse.json({
      isPremium: isPremiumSubscription(subscription),
      subscription,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch subscription status' },
      { status: 500 },
    )
  }
}
