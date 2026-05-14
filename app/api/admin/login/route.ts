import { NextResponse } from 'next/server';

const CREDENTIALS = {
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: 'super_admin',
    scope: 'platform',
  },
  staff: {
    email: process.env.STAFF_EMAIL,
    password: process.env.STAFF_PASSWORD,
    role: 'support',
    scope: 'store',
  },
} as const;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body?.email || !body?.password) {
    return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
  }

  const normalizedEmail = body.email.trim().toLowerCase();

  for (const account of Object.values(CREDENTIALS)) {
    if (!account.email || !account.password) continue;
    if (normalizedEmail === account.email.trim().toLowerCase() && body.password === account.password) {
      return NextResponse.json({
        ok: true,
        role: account.role,
        scope: account.scope,
      });
    }
  }

  return NextResponse.json({ ok: false, error: 'Invalid credentials.' }, { status: 401 });
}
