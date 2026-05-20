import { NextResponse } from 'next/server'
import { redeemInviteForUser } from '@/lib/invites/redeem'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
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

    const result = await redeemInviteForUser({
      userId: user.id,
      createdAt: user.created_at,
      userMetadata: user.user_metadata,
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to redeem invite' },
      { status: 500 },
    )
  }
}
