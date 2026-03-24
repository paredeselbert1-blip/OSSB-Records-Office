'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const COOKIE_TOKEN = '__cookie__';

export default function NewTransmittalPage() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    subject: '',
    documentType: 'Resolution',
    controlNumber: '',
    originOffice: '',
    originAgency: '',
    note: ''
  });

  const canCreate = useMemo(() => user && (user.role === 'admin' || user.role === 'encoder'), [user]);
  const controlNumberLabel = form.documentType === 'Ordinance' ? 'Ordinance No.' : 'Resolution No.';

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
      setForm((v) => ({
        ...v,
        originOffice: me.data.user?.office || '',
        originAgency: me.data.user?.agency || ''
      }));
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  async function onCreate(e) {
    e.preventDefault();
    if (!canCreate) return;
    setError('');
    setNotice('');

    const res = await authedRequest('/api/transmittals', {
      method: 'POST',
      token,
      body: form
    });

    if (!res.ok) {
      setError(res.data?.error || 'Failed to create transmittal');
      return;
    }

    setNotice('Created successfully');
    setForm((v) => ({
      ...v,
      subject: '',
      documentType: 'Resolution',
      controlNumber: '',
      note: ''
    }));
  }

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

  return (
    <section className="panel doclist-template create-doclist-form">
          <h3>Add E-copy</h3>
          {!canCreate ? <p className="muted">Your role cannot create transmittals.</p> : null}
          {error ? <div style={{ color: '#b83a4b', marginTop: '0.4rem' }}>{error}</div> : null}
          {notice ? (
            <div className="create-success-popup" role="status" aria-live="polite">
              <span className="create-success-check" aria-hidden="true">✓</span>
              <span>{notice}</span>
            </div>
          ) : null}

          <form className="create-form" onSubmit={onCreate}>
            <textarea
              value={form.subject}
              onChange={(e) => setForm((v) => ({ ...v, subject: e.target.value }))}
              placeholder="Subject"
              required
              disabled={!canCreate}
            />
            <label>
              Document Type
              <select value={form.documentType} onChange={(e) => setForm((v) => ({ ...v, documentType: e.target.value }))} disabled={!canCreate}>
                <option>Resolution</option>
                <option>Ordinance</option>
              </select>
            </label>
            <label>
              {controlNumberLabel}
              <input value={form.controlNumber} onChange={(e) => setForm((v) => ({ ...v, controlNumber: e.target.value }))} placeholder={controlNumberLabel} required disabled={!canCreate} />
            </label>
            <input value={form.originOffice} onChange={(e) => setForm((v) => ({ ...v, originOffice: e.target.value }))} placeholder="Origin Office" required disabled={!canCreate || user.role === 'encoder'} />
            <input value={form.originAgency} onChange={(e) => setForm((v) => ({ ...v, originAgency: e.target.value }))} placeholder="Origin Agency" disabled={!canCreate} />
            <textarea value={form.note} onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))} placeholder="History note (optional)" disabled={!canCreate} />
            <button type="submit" className="save-user-btn" disabled={!canCreate}>Create</button>
          </form>
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
