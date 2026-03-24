import { NextResponse } from 'next/server';
import store from '../../../lib/store';
import webAuth from '../../../lib/web-auth';

const {
  generateApprovedId,
  hasPermission,
  loadApprovedEcopies,
  saveApprovedEcopies
} = store;
const { getAuthUser } = webAuth;

function isValidDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export async function GET(req) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'read')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const items = loadApprovedEcopies();
  return NextResponse.json({ items });
}

export async function POST(req) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'create')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const body = await req.json();
  const required = ['approvedDate', 'controlNumber'];
  const missing = required.filter((field) => !String(body[field] || '').trim());
  if (missing.length) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 });
  }

  if (!isValidDateKey(body.approvedDate)) {
    return NextResponse.json({ error: 'Invalid approvedDate (YYYY-MM-DD expected)' }, { status: 400 });
  }

  const items = loadApprovedEcopies();
  const now = new Date().toISOString();
  const created = {
    id: generateApprovedId(items),
    approvedDate: String(body.approvedDate).trim(),
    controlNumber: String(body.controlNumber).trim(),
    ecopyLink: String(body.ecopyLink || '').trim(),
    ecopyStatus: String(body.ecopyStatus || '').trim(),
    createdAt: now,
    updatedAt: now
  };

  items.unshift(created);
  saveApprovedEcopies(items);
  return NextResponse.json(created, { status: 201 });
}
