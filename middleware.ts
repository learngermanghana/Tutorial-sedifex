import { NextRequest, NextResponse } from 'next/server';
import { getRoutePolicy } from './lib/admin-access';

const LOGIN_PATH = '/admin/login';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin') || pathname.startsWith('/admin/api')) {
    return NextResponse.next();
  }

  if (pathname === LOGIN_PATH) return NextResponse.next();

  const role = req.cookies.get('sedifex_admin_role')?.value;
  const scope = req.cookies.get('sedifex_admin_scope')?.value;

  if (!role || !scope) {
    return NextResponse.redirect(new URL(LOGIN_PATH, req.url));
  }

  const policy = getRoutePolicy(pathname);
  if (!policy) return NextResponse.next();

  if (!policy.roles.includes(role as never) || !policy.scopes.includes(scope as never)) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
