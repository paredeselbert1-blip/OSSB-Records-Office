import { NextResponse } from 'next/server';
import store from '../../../lib/store';
import webAuth from '../../../lib/web-auth';

const { loadUsers, hasPermission } = store;
const { getAuthUser } = webAuth;

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export async function GET(req) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'read')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const users = loadUsers();
  const offices = uniqueSorted(users.map((u) => String(u.office || '').trim()));
  const agencies = uniqueSorted(users.map((u) => String(u.agency || '').trim()));

  return NextResponse.json({ offices, agencies });
}

