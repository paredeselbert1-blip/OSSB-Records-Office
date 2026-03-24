'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const COOKIE_TOKEN = '__cookie__';

export default function NewUserPage() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'viewer',
    office: '',
    agency: ''
  });

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

  useEffect(() => {
    if (!ready || !user || user.role !== 'admin') return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, token]);

  async function loadUsers() {
    const res = await authedRequest('/api/users', { token });
    if (!res.ok) {
      setError(res.data?.error || 'Failed to load users');
      return;
    }
    setUsers(res.data.users || []);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!user || user.role !== 'admin') return;
    setError('');
    setNotice('');

    const res = await authedRequest('/api/users', {
      method: 'POST',
      token,
      body: form
    });

    if (!res.ok) {
      setError(res.data?.error || 'Failed to create user');
      return;
    }

    setNotice(`User ${res.data?.user?.username || form.username} created successfully.`);
    setForm({
      username: '',
      password: '',
      role: 'viewer',
      office: '',
      agency: ''
    });
    await loadUsers();
  }

  async function onDeleteUser(username) {
    if (!user || user.role !== 'admin') return;
    if (!window.confirm(`Delete user ${username}?`)) return;
    setError('');
    setNotice('');

    const res = await authedRequest(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      token
    });

    if (!res.ok) {
      setError(res.data?.error || 'Failed to delete user');
      return;
    }

    setNotice(`User ${username} deleted successfully.`);
    await loadUsers();
  }

  if (!ready) {
    return (
      <main style={{ maxWidth: 720, margin: '2rem auto' }}>
        <section className="panel">
          <p className="muted">Loading...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ maxWidth: 720, margin: '2rem auto' }}>
        <section className="panel">
          <h3>Authentication required</h3>
          <p className="muted">Please log in first.</p>
          <Link href="/" className="nav-link">Go to Login</Link>
        </section>
      </main>
    );
  }

  if (user.role !== 'admin') {
    return (
      <main style={{ maxWidth: 720, margin: '2rem auto' }}>
        <section className="panel">
          <h3>Access denied</h3>
          <p className="muted">Only admin users can create accounts.</p>
          <Link href="/" className="nav-link">Back to Dashboard</Link>
        </section>
      </main>
    );
  }

  return (
    <section className="panel user-admin-page doclist-template">
          <h3>Admin: Create User</h3>
          {error ? <div style={{ color: '#b83a4b', marginTop: '0.4rem' }}>{error}</div> : null}
          {notice ? <div style={{ color: '#1f7a4a', marginTop: '0.4rem' }}>{notice}</div> : null}
          <form className="create-form" onSubmit={onSubmit}>
            <input value={form.username} onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))} placeholder="Username" required />
            <input type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} placeholder="Password" required />
            <select value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}>
              <option value="viewer">viewer</option>
              <option value="encoder">encoder</option>
              <option value="admin">admin</option>
            </select>
            <input value={form.office} onChange={(e) => setForm((v) => ({ ...v, office: e.target.value }))} placeholder="Office" required />
            <input value={form.agency} onChange={(e) => setForm((v) => ({ ...v, agency: e.target.value }))} placeholder="Agency" required />
            <button type="submit" className="save-user-btn">Save User</button>
          </form>
          <hr />
          <h3>All Users</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Office</th>
                  <th>Agency</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.username}>
                    <td>
                      <button
                        type="button"
                        className="danger delete-user-btn"
                        onClick={() => onDeleteUser(u.username)}
                        disabled={u.username === user.username}
                      >
                        Delete
                      </button>
                    </td>
                    <td>{u.username}</td>
                    <td>{u.role}</td>
                    <td>{u.office}</td>
                    <td>{u.agency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
    </section>
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
