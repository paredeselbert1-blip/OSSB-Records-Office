import { NextResponse } from 'next/server';
import store from '../../../../lib/store';
import webAuth from '../../../../lib/web-auth';

const { hasPermission, loadTransmittals, saveTransmittals } = store;
const { getAuthUser } = webAuth;

export async function GET(req, { params }) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'read')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const { id } = await params;

  const transmittals = await loadTransmittals();
  const item = transmittals.find((t) => t.id === id);
  if (!item) return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function DELETE(req, { params }) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'update')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const { id } = await params;
  const transmittals = await loadTransmittals();
  const next = transmittals.filter((t) => t.id !== id);
  if (next.length === transmittals.length) {
    return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 });
  }

  await saveTransmittals(next);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req, { params }) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'update')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const body = await req.json();
  const allowedFields = [
    'subject',
    'documentType',
    'controlNumber',
    'originOffice',
    'targetAgency',
    'priority',
    'status',
    'currentHolder',
    'remarks',
    'copyFurnish'
  ];
  const providedFields = allowedFields.filter((field) => Object.prototype.hasOwnProperty.call(body || {}, field));
  if (!providedFields.length) return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  const copyFurnishOnly = providedFields.length === 1 && providedFields[0] === 'copyFurnish';

  const { id } = await params;
  const transmittals = await loadTransmittals();
  const item = transmittals.find((t) => t.id === id);
  if (!item) return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 });

  if (auth.user.role === 'encoder' && String(item.originOffice || '').trim() !== auth.user.office) {
    return NextResponse.json({ error: 'Encoder can only edit transmittals for assigned office' }, { status: 403 });
  }

  const statusOptions = new Set(['Created', 'Dispatched', 'Received', 'In Review', 'Completed']);
  const documentTypeOptions = new Set(['Resolution', 'Ordinance']);
  const priorityOptions = new Set(['Low', 'Medium', 'High', 'Urgent']);

  const nextValues = {};
  for (const field of providedFields) {
    if (field === 'remarks') {
      nextValues[field] = String(body[field] || '').trim();
      continue;
    }
    if (field === 'copyFurnish') {
      const incoming = Array.isArray(body[field]) ? body[field] : [];
      nextValues[field] = incoming.map((entry) => ({
        id: String(entry?.id || '').trim() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: String(entry?.name || '').trim(),
        done: Boolean(entry?.done)
      })).filter((entry) => entry.name);
      continue;
    }

    const value = String(body[field] || '').trim();
    if (!value) return NextResponse.json({ error: `${field} cannot be empty` }, { status: 400 });
    nextValues[field] = value;
  }

  if (nextValues.status && !statusOptions.has(nextValues.status)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
  }
  if (nextValues.documentType && !documentTypeOptions.has(nextValues.documentType)) {
    return NextResponse.json({ error: 'Invalid document type value' }, { status: 400 });
  }
  if (nextValues.priority && !priorityOptions.has(nextValues.priority)) {
    return NextResponse.json({ error: 'Invalid priority value' }, { status: 400 });
  }
  if (auth.user.role === 'encoder' && nextValues.originOffice && nextValues.originOffice !== auth.user.office) {
    return NextResponse.json({ error: 'Encoder cannot change origin office outside assigned office' }, { status: 403 });
  }

  for (const field of providedFields) {
    item[field] = nextValues[field];
  }
  item.updatedAt = new Date().toISOString();

  if (!copyFurnishOnly) {
    item.history = Array.isArray(item.history) ? item.history : [];
    const editNote = String(body.note || '').trim();
    item.history.push({
      timestamp: item.updatedAt,
      office: auth.user.office || item.currentHolder || item.originOffice || 'Unknown Office',
      agency: auth.user.agency || item.targetAgency || 'Unknown Agency',
      status: item.status || 'Created',
      note: editNote || `Edited details by ${auth.user.username}`
    });
  }

  await saveTransmittals(transmittals);
  return NextResponse.json(item);
}
