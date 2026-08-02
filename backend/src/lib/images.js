import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Where uploaded product images live. A plain directory backed by a Docker volume:
// no object storage is configured for this deployment, and images must survive a
// container rebuild.
export const UPLOAD_DIRECTORY = process.env.UPLOAD_DIR ?? '/app/uploads';

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

// Enough angles for a used product without turning a listing into an album.
export const MAX_IMAGES_PER_AUCTION = 8;

// The declared Content-Type is attacker-controlled, so the format is decided by the
// file's own magic bytes and only then mapped to an extension.
const SIGNATURES = [
  { extension: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    extension: 'png',
    mime: 'image/png',
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    extension: 'webp',
    mime: 'image/webp',
    test: (b) =>
      b.length > 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP',
  },
];

export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  return SIGNATURES.find((signature) => signature.test(buffer)) ?? null;
}

export async function ensureUploadDirectory() {
  await fs.mkdir(UPLOAD_DIRECTORY, { recursive: true });
}

export async function storeImage(buffer) {
  const type = detectImageType(buffer);
  if (!type) return null;

  await ensureUploadDirectory();
  // Content hash in the name makes the file cacheable forever and deduplicates
  // re-uploads of the same picture; the UUID keeps distinct images distinct.
  const digest = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const filename = `${digest}-${randomUUID().slice(0, 8)}.${type.extension}`;
  await fs.writeFile(path.join(UPLOAD_DIRECTORY, filename), buffer);
  return { filename, mime: type.mime };
}

export async function deleteImage(filename) {
  if (!filename) return;
  // Never let a stored name escape the upload directory.
  const safe = path.basename(String(filename));
  await fs.rm(path.join(UPLOAD_DIRECTORY, safe), { force: true });
}

export const imageUrlFor = (filename) => (filename ? `/api/uploads/${filename}` : null);
