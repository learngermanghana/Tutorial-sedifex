import { NextResponse } from 'next/server';
import { adminStorageBucket, getFirebaseEnvStatus } from '../../../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function safeFilename(value: string) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned || 'advert-image';
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

export async function POST(request: Request) {
  try {
    const env = getFirebaseEnvStatus();
    if (!env.ready) return NextResponse.json({ error: 'Firebase environment variables are not ready.' }, { status: 500 });

    const formData = await request.formData();
    const fileValue = formData.get('imageFile');
    const advertId = typeof formData.get('advertId') === 'string' && String(formData.get('advertId')).trim() ? String(formData.get('advertId')).trim() : 'new';

    if (!(fileValue instanceof File) || fileValue.size === 0) {
      return NextResponse.json({ error: 'Choose an image first.' }, { status: 400 });
    }
    if (fileValue.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Advert image is too large. Maximum upload size is 5 MB.' }, { status: 413 });
    }

    const buffer = Buffer.from(await fileValue.arrayBuffer());
    const detectedMimeType = detectImageMimeType(buffer);
    if (!detectedMimeType || !SUPPORTED_IMAGE_TYPES.has(detectedMimeType)) {
      return NextResponse.json({ error: 'Unsupported image file. Upload JPG, PNG, WEBP, or GIF.' }, { status: 400 });
    }

    const originalName = safeFilename(fileValue.name || 'advert-image');
    const basename = originalName.replace(/\.(jpe?g|png|webp|gif)$/i, '') || 'advert-image';
    const extension = resolveExtension(originalName, detectedMimeType);
    const objectName = `marketplace-adverts/${advertId}/${Date.now()}-${basename}${extension}`;
    const bucket = adminStorageBucket();
    const target = bucket.file(objectName);

    await target.save(buffer, {
      resumable: false,
      metadata: {
        contentType: detectedMimeType,
        cacheControl: 'public,max-age=31536000,immutable',
      },
    });

    return NextResponse.json({
      success: true,
      imageUrl: storagePublicUrl(bucket.name, objectName),
      imagePath: objectName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Image upload failed.');
    const isTruncated = /truncated/i.test(message);
    return NextResponse.json(
      { error: isTruncated ? 'Upload request was truncated before it reached the server. Please retry with a smaller image (under 2 MB) or convert to JPG/WEBP.' : message },
      { status: isTruncated ? 413 : 500 },
    );
  }
}
