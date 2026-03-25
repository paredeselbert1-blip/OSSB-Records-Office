import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import store from '../../../../../lib/store';
import webAuth from '../../../../../lib/web-auth';

const { hasPermission, loadTransmittals, saveTransmittals } = store;
const { getAuthUser } = webAuth;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const ALLOWED_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

function safeFileName(name) {
  return String(name || 'scan')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120) || 'scan';
}

export async function POST(req, { params }) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'update')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const { id } = await params;
  const transmittals = await loadTransmittals();
  const item = transmittals.find((t) => t.id === id);
  if (!item) return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 });

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
  }

  const fileSize = Number(file.size || 0);
  if (!fileSize) return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
  if (fileSize > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File is too large. Max 10MB.' }, { status: 400 });
  }

  const originalName = file.name || 'scan';
  const ext = path.extname(originalName).toLowerCase();
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
  }
  if (ext && !ALLOWED_EXTS.has(ext)) {
    return NextResponse.json({ error: 'Unsupported file extension.' }, { status: 400 });
  }

  const safeName = safeFileName(originalName);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${stamp}-${safeName}`;
  const folder = path.join(process.cwd(), 'public', 'uploads', 'transmittal-letters', id);

  fs.mkdirSync(folder, { recursive: true });
  const filePath = path.join(folder, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const urlPath = `/uploads/transmittal-letters/${id}/${fileName}`;
  const uploadedAt = new Date().toISOString();

  item.letterUploads = Array.isArray(item.letterUploads) ? item.letterUploads : [];
  item.letterUploads.push({
    uploadedAt,
    uploadedBy: auth.user.username || 'Unknown',
    fileName,
    url: urlPath,
    remarks: ''
  });

  item.updatedAt = uploadedAt;

  await saveTransmittals(transmittals);
  return NextResponse.json({ ok: true, upload: item.letterUploads[item.letterUploads.length - 1] });
}

export async function PATCH(req, { params }) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'update')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const { id } = await params;
  const transmittals = await loadTransmittals();
  const item = transmittals.find((t) => t.id === id);
  if (!item) return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 });

  const body = await req.json();
  const uploadedAt = String(body.uploadedAt || '').trim();
  const fileName = String(body.fileName || '').trim();
  if (!uploadedAt || !fileName) {
    return NextResponse.json({ error: 'Missing upload identifier' }, { status: 400 });
  }

  item.letterUploads = Array.isArray(item.letterUploads) ? item.letterUploads : [];
  const target = item.letterUploads.find((entry) => entry.uploadedAt === uploadedAt && entry.fileName === fileName);
  if (!target) return NextResponse.json({ error: 'Upload not found' }, { status: 404 });

  target.remarks = String(body.remarks || '').trim();
  item.updatedAt = new Date().toISOString();

  await saveTransmittals(transmittals);
  return NextResponse.json({ ok: true, upload: target });
}
