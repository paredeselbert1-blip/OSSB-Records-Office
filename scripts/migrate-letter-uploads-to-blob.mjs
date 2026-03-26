import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const store = require('../lib/store');

const { loadTransmittals, saveTransmittals } = store;

function isLocalUploadUrl(url) {
  return typeof url === 'string' && url.startsWith('/uploads/transmittal-letters/');
}

function resolveLocalFilePath(url) {
  const relative = url.replace(/^\/+/, '');
  return path.join(process.cwd(), 'public', relative);
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Missing BLOB_READ_WRITE_TOKEN. Set it before running this script.');
    process.exit(1);
  }

  const { put } = await import('@vercel/blob');
  const transmittals = await loadTransmittals();
  let scanned = 0;
  let migrated = 0;
  let skipped = 0;

  for (const item of transmittals) {
    const uploads = Array.isArray(item.letterUploads) ? item.letterUploads : [];
    for (const entry of uploads) {
      if (!isLocalUploadUrl(entry.url)) {
        skipped += 1;
        continue;
      }
      scanned += 1;
      const localPath = resolveLocalFilePath(entry.url);
      if (!(await fileExists(localPath))) {
        skipped += 1;
        continue;
      }

      const buffer = await fs.readFile(localPath);
      const blobPath = `transmittal-letters/${item.id}/${entry.fileName || path.basename(localPath)}`;
      const blob = await put(blobPath, buffer, {
        access: 'public',
        contentType: entry.fileName?.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'image/jpeg',
        addRandomSuffix: false
      });

      entry.url = blob.url;
      entry.migratedAt = new Date().toISOString();
      migrated += 1;
    }
  }

  await saveTransmittals(transmittals);
  console.log(`Scanned: ${scanned}`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
