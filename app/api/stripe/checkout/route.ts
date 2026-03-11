import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Stripe checkout is temporarily disabled. Please use crypto checkout.' },
    { status: 503 },
  );
}
