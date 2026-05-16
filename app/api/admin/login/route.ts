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

function configuredAccounts() {
  return Object.values(CREDENTIALS).filter((account) => account.email && account.password);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() || '';
  const password = body?.password || '';

  if (!email && !password) {
    return NextResponse.json({ ok: false, code: 'missing_fields', error: 'Enter your admin email and password.' }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ ok: false, code: 'missing_email', error: 'Enter your admin email address.' }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ ok: false, code: 'missing_password', error: 'Enter your password.' }, { status: 400 });
  }

  const accounts = configuredAccounts();

  if (accounts.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: 'login_not_configured',
        error: 'Admin login is not configured. Add ADMIN_EMAIL and ADMIN_PASSWORD in the environment settings.',
      },
      { status: 500 },
    );
  }

  const account = accounts.find((item) => item.email?.trim().toLowerCase() === email);

  if (!account) {
    return NextResponse.json(
      {
        ok: false,
        code: 'email_not_found',
        error: 'This email is not allowed to access Sedifex Admin. Check the email address or ask the platform owner to add it.',
      },
      { status: 401 },
    );
  }

  if (password !== account.password) {
    return NextResponse.json(
      {
        ok: false,
        code: 'wrong_password',
        error: 'The password is incorrect. Check the password and try again.',
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    role: account.role,
    scope: account.scope,
  });
}
