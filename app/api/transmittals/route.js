import { NextResponse } from 'next/server';
import store from '../../../lib/store';
import webAuth from '../../../lib/web-auth';

const { filterTransmittals, generateId, hasPermission, loadTransmittals, saveTransmittals, summarize } = store;
const { getAuthUser } = webAuth;

export async function GET(req) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'read')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const url = new URL(req.url);
  const query = {
    q: url.searchParams.get('q') || '',
    status: url.searchParams.get('status') || '',
    office: url.searchParams.get('office') || '',
    agency: url.searchParams.get('agency') || '',
    from: url.searchParams.get('from') || '',
    to: url.searchParams.get('to') || ''
  };

  const transmittals = await loadTransmittals();
  const filtered = filterTransmittals(transmittals, query);
  return NextResponse.json({ items: filtered, totals: summarize(filtered) });
}

export async function POST(req) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'create')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const body = await req.json();
  const required = ['subject', 'controlNumber', 'originOffice'];
  const missing = required.filter((field) => !String(body[field] || '').trim());
  if (missing.length) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 });
  }

  if (auth.user.role === 'encoder' && String(body.originOffice).trim() !== auth.user.office) {
    return NextResponse.json({ error: 'Encoder can only create transmittals for assigned office' }, { status: 403 });
  }

  const transmittals = await loadTransmittals();
  const now = new Date().toISOString();
  const created = {
    id: generateId(transmittals),
    subject: String(body.subject).trim(),
    controlNumber: String(body.controlNumber).trim(),
    originOffice: String(body.originOffice).trim(),
    targetAgency: String(body.targetAgency || body.originAgency || auth.user.agency || 'Internal Office').trim(),
    priority: String(body.priority || 'Medium').trim(),
    status: 'Created',
    createdAt: now,
    updatedAt: now,
    currentHolder: String(body.originOffice).trim(),
    remarks: String(body.remarks || '').trim(),
    history: [
      {
        timestamp: now,
        office: String(body.originOffice).trim(),
        agency: String(body.originAgency || auth.user.agency || 'Internal Office').trim(),
        status: 'Created',
        note: String(body.note || `Transmittal created by ${auth.user.username}`).trim()
      }
    ],
    copyFurnish: []
  };

  transmittals.unshift(created);
  await saveTransmittals(transmittals);
  return NextResponse.json(created, { status: 201 });
}
