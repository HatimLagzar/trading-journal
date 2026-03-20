import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const protectedPaths = ['/trades', '/dashboard', '/settings']
  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  if (
    request.nextUrl.pathname.startsWith('/trades') &&
    request.nextUrl.searchParams.get('intent') === 'premium' &&
    request.nextUrl.searchParams.get('step') === 'plan'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/signup'
    url.search = '?intent=premium&step=plan'
    return NextResponse.redirect(url)
  }

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const authPaths = ['/login', '/signup']
  const isAuthPath = authPaths.some((path) => request.nextUrl.pathname.startsWith(path))
  const isSignupPlanStep =
    request.nextUrl.pathname.startsWith('/signup') && request.nextUrl.searchParams.get('step') === 'plan'

  if (isAuthPath && user && !isSignupPlanStep) {
    const url = request.nextUrl.clone()
    url.pathname = '/trades'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
