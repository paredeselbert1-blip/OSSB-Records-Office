import { NextResponse } from 'next/server';
import store from '../../../lib/store';
import webAuth from '../../../lib/web-auth';

const { loadUsers, saveUsers } = store;
const { getAuthUser } = webAuth;

const ALLOWED_ROLES = new Set(['admin', 'encoder', 'viewer']);

function sanitizeUser(u) {
  return {
    username: u.username,
    role: u.role,
    office: u.office || '',
    agency: u.agency || ''
  };
}

export async function GET(req) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const users = (await loadUsers()).map(sanitizeUser);
  return NextResponse.json({ users });
}

export async function POST(req) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const body = await req.json();
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  const role = String(body.role || '').trim().toLowerCase();
  const office = String(body.office || '').trim();
  const agency = String(body.agency || '').trim();

  if (!username || !password || !role || !office || !agency) {
    return NextResponse.json(
      { error: 'Missing required fields: username, password, role, office, agency' },
      { status: 400 }
    );
  }

  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const users = await loadUsers();
  const exists = users.some((u) => String(u.username || '').toLowerCase() === username.toLowerCase());
  if (exists) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }

  const created = { username, password, role, office, agency };
  users.push(created);
  await saveUsers(users);

  return NextResponse.json(
    {
      user: sanitizeUser(created)
    },
    { status: 201 }
  );
}
