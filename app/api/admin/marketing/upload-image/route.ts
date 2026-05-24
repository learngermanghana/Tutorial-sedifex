import { NextResponse } from 'next/server';
import { adminStorageBucket } from '../../../../../lib/firebase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function cookieValue(req: Request, name: string) {
  return req.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.split('=')[1];
}

function isAllowedRole(role?: string) {
  return role === 'super_admin' || role === 'ops_admin' || role === 'support';
}

function safeFilename(value: string) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned || 'marketing-image';
}

function resolveExtension(filename: string, mimeType: string) {
  const fromName = filename.match(/\.([a-zA-Z0-9_-]{1,10})$/)?.[0]?.toLowerCase();
  if (fromName && ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fromName)) return fromName;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.jpg';
}

function detectImageMimeType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3], buffer[4], buffer[5]))) return 'image/gif';
  return null;
}

function storagePublicUrl(bucketName: string, objectName: string) {
  return `https://storage.googleapis.com/${bucketName}/${encodeURI(objectName)}`;
}

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status });
}

function errorJson(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error || 'Image upload failed.');
  return json({ ok: false, error: message }, status);
}

export async function GET() {
  return json({
    ok: true,
    route: '/api/admin/marketing/upload-image',
    method: 'POST',
    field: 'imageFile',
    maxSizeMb: 5,
    supportedTypes: Array.from(SUPPORTED_IMAGE_TYPES),
  });
}

export async function POST(req: Request) {
  try {
    const role = cookieValue(req, 'sedifex_admin_role');
    if (!isAllowedRole(role)) {
      return json({ ok: false, error: 'Only super_admin, ops_admin, or support can upload marketing images.', currentRole: role || null }, 403);
    }

    const formData = await req.formData();
    const fileValue = formData.get('imageFile');
    if (!(fileValue instanceof File) || fileValue.size === 0) {
      return json({ ok: false, error: 'No image file was uploaded. Use form field imageFile.' }, 400);
    }

    if (fileValue.size > MAX_IMAGE_BYTES) {
      return json({ ok: false, error: 'Image is too large. Maximum upload size is 5 MB. Please compress or resize it first.' }, 413);
    }

    const buffer = Buffer.from(await fileValue.arrayBuffer());
    const detectedMimeType = detectImageMimeType(buffer);
    if (!detectedMimeType || !SUPPORTED_IMAGE_TYPES.has(detectedMimeType)) {
      return json({ ok: false, error: 'Unsupported image file. Please upload JPG, PNG, WEBP, or GIF.' }, 400);
    }

    const bucket = adminStorageBucket();
    const originalName = safeFilename(fileValue.name || 'marketing-image');
    const basename = originalName.replace(/\.(jpe?g|png|webp|gif)$/i, '') || 'marketing-image';
    const extension = resolveExtension(originalName, detectedMimeType);
    const objectName = `marketing-campaign-images/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${basename}${extension}`;
    const target = bucket.file(objectName);

    await target.save(buffer, {
      resumable: false,
      metadata: {
        contentType: detectedMimeType,
        cacheControl: 'public,max-age=31536000,immutable',
      },
    });

    return json({
      ok: true,
      imageUrl: storagePublicUrl(bucket.name, objectName),
      imagePath: objectName,
      contentType: detectedMimeType,
      sizeBytes: fileValue.size,
    });
  } catch (error) {
    console.error('[marketing-upload-image] failed', error);
    return errorJson(error);
  }
}
