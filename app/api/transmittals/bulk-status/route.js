import { NextResponse } from 'next/server';
import store from '../../../../lib/store';
import webAuth from '../../../../lib/web-auth';

const { hasPermission, loadTransmittals, saveTransmittals } = store;
const { getAuthUser } = webAuth;

export async function POST(req) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id || '').trim()).filter(Boolean) : [];
  const status = String(body.status || '').trim();
  const office = String(body.office || '').trim();
  const agency = String(body.agency || '').trim();
  const recipientOffice = String(body.recipientOffice || '').trim();
  const recipientAgency = String(body.recipientAgency || '').trim();

  if (!ids.length) {
    return NextResponse.json({ error: 'At least one transmittal id is required' }, { status: 400 });
  }
  if (!status || !office || !agency) {
    return NextResponse.json({ error: 'Fields required: status, office, agency' }, { status: 400 });
  }

  const canFullUpdate = hasPermission(auth.user, 'update');
  const canReceiveOnly = hasPermission(auth.user, 'receive') && status === 'Received';
  if (!canFullUpdate && !canReceiveOnly) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  if (auth.user.role === 'encoder' && office !== auth.user.office) {
    return NextResponse.json({ error: 'Encoder can only post updates for assigned office' }, { status: 403 });
  }
  if (auth.user.role === 'viewer') {
    if (office !== auth.user.office || agency !== auth.user.agency) {
      return NextResponse.json({ error: 'Viewer can only acknowledge receipt for assigned office/agency' }, { status: 403 });
    }
  }

  const uniqueIds = Array.from(new Set(ids));
  const transmittals = loadTransmittals();
  const now = new Date().toISOString();
  const updatedIds = [];
  const missingIds = [];
  const note = String(body.note || `Bulk updated by ${auth.user.username}`).trim();
  const nextRemarks = canFullUpdate && body.remarks !== undefined ? String(body.remarks || '').trim() : undefined;

  uniqueIds.forEach((id) => {
    const item = transmittals.find((t) => t.id === id);
    if (!item) {
      missingIds.push(id);
      return;
    }

    item.status = status;
    item.updatedAt = now;
    item.currentHolder = office;
    if (canFullUpdate && recipientOffice && status === 'Dispatched') {
      item.targetAgency = recipientOffice;
    }
    if (nextRemarks !== undefined) item.remarks = nextRemarks;
    item.history = Array.isArray(item.history) ? item.history : [];
    item.history.push({
      timestamp: now,
      office,
      agency,
      status,
      note,
      recipientOffice,
      recipientAgency
    });
    updatedIds.push(id);
  });

  if (!updatedIds.length) {
    return NextResponse.json({ error: 'No matching transmittals found', missingIds }, { status: 404 });
  }

  saveTransmittals(transmittals);
  return NextResponse.json({
    updatedCount: updatedIds.length,
    updatedIds,
    missingIds
  });
}
