import { NextResponse } from 'next/server';
import store from '../../../../lib/store';

const { login } = store;

export async function POST(req) {
  const body = await req.json();
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  const remember = Boolean(body.remember);
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  const result = login(username, password, { remember });
  if (!result) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const res = NextResponse.json(result);
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  };
  if (remember) {
    cookieOptions.maxAge = 60 * 60 * 24 * 30;
  }
  res.cookies.set('transmittal_token', result.token, cookieOptions);
  return res;
}
