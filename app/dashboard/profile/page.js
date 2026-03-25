'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const COOKIE_TOKEN = '__cookie__';

export default function ProfilePage() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });

  useEffect(() => {
    const saved = sessionStorage.getItem('transmittal_token') || '';
    const nextToken = saved || COOKIE_TOKEN;
    setToken(nextToken);
    (async () => {
      const me = await authedRequest('/api/me', { token: nextToken });
      if (!me.ok) {
        sessionStorage.removeItem('transmittal_token');
        setReady(true);
        return;
      }
      if (!saved) {
        sessionStorage.setItem('transmittal_token', COOKIE_TOKEN);
      }
      setUser(me.data.user || null);
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <main className="profile-shell">
        <section className="profile-card">
          <p className="muted">Loading...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="profile-shell">
        <section className="profile-card">
          <h1 className="profile-title">Authentication required</h1>
          <p className="profile-subtitle">Please log in first.</p>
          <Link href="/" className="profile-action">Go to Login</Link>
        </section>
      </main>
    );
  }

  async function onPasswordChange(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!passwordForm.password) {
      setError('Password is required.');
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setError('Passwords do not match.');
      return;
    }

    const res = await authedRequest('/api/me/password', {
      method: 'PATCH',
      token,
      body: { password: passwordForm.password }
    });
    if (!res.ok) {
      setError(res.data?.error || 'Failed to update password.');
      return;
    }
    setNotice('Password updated.');
    setPasswordForm({ password: '', confirm: '' });
  }

  return (
    <main className="profile-shell">
      <section className="profile-card">
        <h1 className="profile-title">Profile</h1>
        <p className="profile-subtitle">Manage your account details and password.</p>
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        {notice ? <div className="profile-alert profile-alert-success">{notice}</div> : null}

        <div className="profile-section">
          <h2>User Details</h2>
          <div className="profile-info-grid">
            <div className="profile-info-row">
              <span>Username</span>
              <strong>{user.username}</strong>
            </div>
            <div className="profile-info-row">
              <span>Role</span>
              <strong>{user.role}</strong>
            </div>
            <div className="profile-info-row">
              <span>Office</span>
              <strong>{user.office || '-'}</strong>
            </div>
            <div className="profile-info-row">
              <span>Agency</span>
              <strong>{user.agency || '-'}</strong>
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h2>Change Password</h2>
          <form className="profile-form" onSubmit={onPasswordChange}>
            <label className="profile-field">
              <span className="profile-label">New Password</span>
              <input
                type="password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm((v) => ({ ...v, password: e.target.value }))}
                placeholder="New password"
                required
              />
            </label>
            <label className="profile-field">
              <span className="profile-label">Confirm Password</span>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((v) => ({ ...v, confirm: e.target.value }))}
                placeholder="Confirm password"
                required
              />
            </label>
            <div className="profile-actions">
              <button type="submit" className="profile-primary">Update Password</button>
              <Link href="/dashboard" className="profile-action">Back to Dashboard</Link>
            </div>
          </form>
        </div>
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
