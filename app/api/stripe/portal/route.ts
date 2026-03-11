import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Stripe portal is temporarily disabled while crypto-only billing is active.' },
    { status: 503 },
  );
}
