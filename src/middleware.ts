import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/auth', '/cart', '/checkout', '/confirmation', '/product', '/api'];

// Cookie name used by @supabase/auth-helpers-nextjs v0.7 default storage key
const SESSION_COOKIE = 'supabase.auth.token';

function getSessionFromCookies(req: NextRequest): boolean {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/(?:^|;\s*)supabase\.auth\.token=([^;]+)/);
  if (!match) return false;

  try {
    const decoded = decodeURIComponent(match[1]);
    const parsed = JSON.parse(decoded);

    // Auth-helpers v0.7 stores session as array: [access_token, refresh_token, ...]
    if (!Array.isArray(parsed) || !parsed[0]) return false;

    const jwt = parsed[0] as string;
    const parts = jwt.split('.');
    if (parts.length !== 3) return false;

    // Decode the payload (base64url → JSON)
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = atob(payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), '='));
    const payload = JSON.parse(payloadJson) as { exp?: number; sub?: string; aud?: string };

    if (!payload.exp || !payload.sub) return false;

    // Allow a 30-second margin for clock skew
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSeconds - 30) return false;

    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (isPublic) return res;

  if (pathname.startsWith('/dashboard')) {
    const hasSession = getSessionFromCookies(req);

    if (!hasSession) {
      const loginUrl = new URL('/auth/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
