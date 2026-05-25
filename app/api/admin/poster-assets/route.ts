import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function isAllowedAssetUrl(value: string) {
  try {
    const url = new URL(value);
    return ALLOWED_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function fallbackMimeType(url: string) {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get('url') || '';

  if (!targetUrl || !isAllowedAssetUrl(targetUrl)) {
    return NextResponse.json({ error: 'Invalid asset URL.' }, { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      cache: 'no-store',
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'SedifexPosterGenerator/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Asset request failed with ${response.status}.` }, { status: 502 });
    }

    const contentLength = Number(response.headers.get('content-length') || '0');
    if (contentLength > MAX_ASSET_BYTES) {
      return NextResponse.json({ error: 'Asset is too large for poster export.' }, { status: 413 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_ASSET_BYTES) {
      return NextResponse.json({ error: 'Asset is too large for poster export.' }, { status: 413 });
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0] || fallbackMimeType(targetUrl);
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return NextResponse.json({ dataUrl: `data:${mimeType};base64,${base64}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to fetch poster asset.' },
      { status: 500 }
    );
  }
}
