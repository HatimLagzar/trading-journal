import { createBrowserClient } from '@supabase/ssr'

// Client-side Supabase client (singleton)
// Use this in 'use client' components
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
