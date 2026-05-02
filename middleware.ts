import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Routes that don't require authentication
const publicRoutes = ['/login', '/register', '/api/auth', '/api/register']

// Routes that use API key auth instead of session
const apiKeyRoutes = ['/api/sync']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only run auth in cloud mode
  if (process.env.DATA_SOURCE_MODE !== 'cloud') {
    return NextResponse.next()
  }

  // Check if route is public
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check static files, _next, etc.
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // API key routes — validate Bearer token
  if (apiKeyRoutes.some((route) => pathname.startsWith(route))) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
    }
    // Actual key validation happens in the route handler
    return NextResponse.next()
  }

  // Session-based routes — validate JWT
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Page routes redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
