import { NextResponse } from 'next/server'
import { redeemInviteForUser } from '@/lib/invites/redeem'
import { createClient } from '@/lib/supabase/server'

type SignupRequestBody = {
  email?: string
  password?: string
  inviteToken?: string | null
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupRequestBody
    const email = body.email?.trim() ?? ''
    const password = body.password ?? ''
    const inviteToken = body.inviteToken?.trim() ?? ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: inviteToken
          ? {
              invite_token: inviteToken,
            }
          : {},
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const user = data.user
    if (user && inviteToken) {
      await redeemInviteForUser({
        userId: user.id,
        createdAt: user.created_at,
        userMetadata: user.user_metadata,
      })
    }

    return NextResponse.json({
      success: true,
      hasSession: Boolean(data.session),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to sign up' },
      { status: 500 },
    )
  }
}
