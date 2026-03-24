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
      <main style={{ maxWidth: 920, margin: '2rem auto' }}>
        <section className="panel"><p className="muted">Loading...</p></section>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ maxWidth: 920, margin: '2rem auto' }}>
        <section className="panel">
          <h3>Authentication required</h3>
          <p className="muted">Please log in first.</p>
          <Link href="/" className="nav-link">Go to Login</Link>
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
    <>
      {error ? <div style={{ color: '#b83a4b', marginBottom: '0.5rem' }}>{error}</div> : null}
      {notice ? <div style={{ color: '#1f7a4a', marginBottom: '0.5rem' }}>{notice}</div> : null}
      <section className="panel">
        <h3>User Details</h3>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <th>Username</th>
                <td>{user.username}</td>
              </tr>
              <tr>
                <th>Role</th>
                <td>{user.role}</td>
              </tr>
              <tr>
                <th>Office</th>
                <td>{user.office || '-'}</td>
              </tr>
              <tr>
                <th>Agency</th>
                <td>{user.agency || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Change Password</h3>
        <div className="table-wrap">
          <form onSubmit={onPasswordChange}>
            <table>
              <tbody>
                <tr>
                  <th>New Password</th>
                  <td>
                    <input
                      type="password"
                      value={passwordForm.password}
                      onChange={(e) => setPasswordForm((v) => ({ ...v, password: e.target.value }))}
                      placeholder="New password"
                      required
                    />
                  </td>
                </tr>
                <tr>
                  <th>Confirm Password</th>
                  <td>
                    <input
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm((v) => ({ ...v, confirm: e.target.value }))}
                      placeholder="Confirm password"
                      required
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="doclist-top-action" style={{ justifyContent: 'flex-start', marginTop: '0.6rem' }}>
              <button type="submit" className="doclist-export-btn">Update Password</button>
            </div>
          </form>
        </div>

        <div className="toolbar">
          <Link href="/dashboard" className="nav-link">Back to Dashboard</Link>
        </div>
      </section>
    </>
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
