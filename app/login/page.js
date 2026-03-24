'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const COOKIE_TOKEN = '__cookie__';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get('next') || '/dashboard';

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = sessionStorage.getItem('transmittal_token') || '';
      const me = await authedRequest('/api/me', { token: saved || COOKIE_TOKEN });
      if (me.ok) {
        sessionStorage.setItem('transmittal_token', saved || COOKIE_TOKEN);
        router.replace(nextPath);
        return;
      }
      sessionStorage.removeItem('transmittal_token');
      setIsCheckingSession(false);
    })();
  }, [nextPath, router]);

  async function onLogin(e) {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...loginForm, remember: rememberMe }),
      credentials: 'include'
    });
    const data = await res.json();
    setIsSubmitting(false);
    if (!res.ok) {
      setError(data.error || 'Login failed');
      return;
    }

    sessionStorage.setItem('transmittal_token', COOKIE_TOKEN);
    setError('');
    setLoginForm({ username: '', password: '' });
    router.replace(nextPath);
  }

  if (isCheckingSession) {
    return (
      <main style={{ maxWidth: 500, margin: '2rem auto' }}>
        <section className="panel">
          <p className="muted">Checking session...</p>
        </section>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 500, margin: '2rem auto' }}>
      <section className="panel">
        <h1>Transmittal Monitoring System</h1>
        <p className="muted">Login to track cross-office and cross-agency transmittals.</p>
        {error ? <p style={{ color: '#b83a4b' }}>{error}</p> : null}
        <form className="login-form" onSubmit={onLogin}>
          <input
            placeholder="Username"
            value={loginForm.username}
            onChange={(e) => setLoginForm((v) => ({ ...v, username: e.target.value }))}
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm((v) => ({ ...v, password: e.target.value }))}
            required
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Keep me signed in
          </label>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
}

async function authedRequest(url, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (token && token !== COOKIE_TOKEN) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error' } };
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  return { ok: res.ok, status: res.status, data };
}
