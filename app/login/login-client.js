'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const COOKIE_TOKEN = '__cookie__';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get('next') || '/dashboard';

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
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
    let res;
    let data = {};
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...loginForm, remember: rememberMe }),
        credentials: 'include'
      });
      try {
        data = await res.json();
      } catch {
        data = {};
      }
    } catch {
      setIsSubmitting(false);
      setError('Network error. Please try again.');
      return;
    }
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
    <main className="login-shell">
      <section className="login-card">
        <h1 className="login-title">Welcome to</h1>
        <h2 className="login-brand">OSSB Records Office</h2>
        <p className="login-subtitle">Sign in to manage transmittals, e-copies, and posting logs.</p>
        {error ? <p className="login-error">{error}</p> : null}
        <form className="login-form login-form-modern" onSubmit={onLogin}>
          <label className="login-field">
            <span className="login-icon" aria-hidden="true">
              @
            </span>
            <input
              className="login-input"
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm((v) => ({ ...v, username: e.target.value }))}
              required
            />
          </label>
          <label className="login-field">
            <span className="login-icon" aria-hidden="true">
              *
            </span>
            <input
              className="login-input"
              placeholder="Password"
              type={showPassword ? 'text' : 'password'}
              value={loginForm.password}
              onChange={(e) => setLoginForm((v) => ({ ...v, password: e.target.value }))}
              required
            />
            <button
              type="button"
              className="login-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="login-eye-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l2.08 2.08C2.47 7.1 1.07 9 1.07 12c2.1 4.2 6.1 6.5 10.93 6.5 2.22 0 4.23-.47 5.98-1.38l2.49 2.49a.75.75 0 1 0 1.06-1.06l-18-18Zm6.55 6.55 4.36 4.36A2.5 2.5 0 0 0 10.08 9.02Zm7.72 7.72a10.2 10.2 0 0 1-5.8 1.76c-4.1 0-7.3-1.8-9.3-5 1.1-1.8 2.6-3.1 4.3-3.95l1.49 1.49a4 4 0 0 0 5.01 5.01l1.43 1.43c.5.2 1.05.3 1.57.3a4 4 0 0 0 1.3-.2ZM9.05 5.54A10.5 10.5 0 0 1 12 5c4.83 0 8.83 2.3 10.93 6.5a12.2 12.2 0 0 1-3.19 3.84l-1.5-1.5a4 4 0 0 0-5.08-5.08L9.05 5.54Z"
                  />
                </svg>
              ) : (
                <svg className="login-eye-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 5c4.83 0 8.83 2.3 10.93 6.5-2.1 4.2-6.1 6.5-10.93 6.5-4.83 0-8.83-2.3-10.93-6.5C3.17 7.3 7.17 5 12 5Zm0 2c-3.57 0-6.6 1.58-8.44 4.5 1.84 2.92 4.87 4.5 8.44 4.5 3.57 0 6.6-1.58 8.44-4.5C18.6 8.58 15.57 7 12 7Zm0 2.25A3.75 3.75 0 1 1 8.25 13 3.75 3.75 0 0 1 12 9.25Zm0 1.5A2.25 2.25 0 1 0 14.25 13 2.25 2.25 0 0 0 12 10.75Z"
                  />
                </svg>
              )}
            </button>
          </label>
          <label className="login-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Keep me signed in
          </label>
          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Sign in'}
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
