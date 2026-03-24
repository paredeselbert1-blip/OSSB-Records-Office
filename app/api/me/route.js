import { NextResponse } from 'next/server';
import webAuth from '../../../lib/web-auth';

const { getAuthUser } = webAuth;

export async function GET(req) {
  const auth = getAuthUser(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ user: auth.user });
}
