import { NextResponse } from 'next/server';
import store from '../../../../lib/store';
import webAuth from '../../../../lib/web-auth';

const { loadUsers, saveUsers } = store;
const { getAuthUser } = webAuth;

export async function PATCH(req) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const password = String(body.password || '').trim();
  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  const users = loadUsers();
  const idx = users.findIndex((u) => String(u.username || '').toLowerCase() === auth.user.username.toLowerCase());
  if (idx < 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  users[idx] = { ...users[idx], password };
  saveUsers(users);
  return NextResponse.json({ ok: true });
}

