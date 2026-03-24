import { NextResponse } from 'next/server';
import store from '../../../../../lib/store';
import webAuth from '../../../../../lib/web-auth';

const { hasPermission, loadTransmittals, saveTransmittals } = store;
const { getAuthUser } = webAuth;

export async function PATCH(req, { params }) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const status = String(body.status || '').trim();
  const office = String(body.office || '').trim();
  const agency = String(body.agency || '').trim();

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

  const { id } = await params;

  const transmittals = loadTransmittals();
  const item = transmittals.find((t) => t.id === id);
  if (!item) return NextResponse.json({ error: 'Transmittal not found' }, { status: 404 });

  const now = new Date().toISOString();
  item.status = status;
  item.updatedAt = now;
  item.currentHolder = office;
  if (body.remarks !== undefined && (canFullUpdate || canReceiveOnly)) {
    item.remarks = String(body.remarks || '').trim();
  }

  item.history.push({
    timestamp: now,
    office,
    agency,
    status,
    note: String(body.note || `Updated by ${auth.user.username}`).trim()
  });

  saveTransmittals(transmittals);
  return NextResponse.json(item);
}
