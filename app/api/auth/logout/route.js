import { NextResponse } from 'next/server';
import store from '../../../../lib/store';
import webAuth from '../../../../lib/web-auth';

const { logout } = store;
const { getTokenFromRequest } = webAuth;

export async function POST(req) {
  const token = getTokenFromRequest(req);
  logout(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('transmittal_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });
  return res;
}
