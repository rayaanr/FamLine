import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Optimistic auth gate: bounce requests without a session cookie to /login.
 * Role-level enforcement (tree access, super-admin) happens server-side in the
 * page guards (`lib/auth-server.ts`) where the full session is available.
 */
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set(
      'redirect',
      request.nextUrl.pathname + request.nextUrl.search,
    )
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/tree/:path*', '/admin/:path*'],
}
