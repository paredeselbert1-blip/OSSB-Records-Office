import { NextResponse } from 'next/server';
import store from '../../../../lib/store';
import webAuth from '../../../../lib/web-auth';

const { loadUsers, saveUsers } = store;
const { getAuthUser } = webAuth;

export async function DELETE(req, { params }) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const { username } = await params;
  const target = decodeURIComponent(String(username || '')).trim();
  if (!target) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  if (target.toLowerCase() === auth.user.username.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }

  const users = loadUsers();
  const next = users.filter((u) => String(u.username || '').toLowerCase() !== target.toLowerCase());
  if (next.length === users.length) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  saveUsers(next);
  return NextResponse.json({ ok: true });
}
