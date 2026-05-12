import { NextResponse } from 'next/server';
import { issueClientToken } from '@/lib/integrations-store';

export async function POST(req: Request) {
  const body = await req.json();
  if (body.grant_type !== 'client_credentials') return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  const token = await issueClientToken(body.client_id, body.client_secret);
  if (!token) return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
  return NextResponse.json(token);
}
