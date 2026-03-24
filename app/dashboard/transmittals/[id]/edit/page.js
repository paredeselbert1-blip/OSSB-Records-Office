'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

const COOKIE_TOKEN = '__cookie__';

const emptyForm = {
  subject: '',
  documentType: 'Resolution',
  controlNumber: '',
  originOffice: '',
  targetAgency: '',
  status: 'Created',
  currentHolder: '',
  remarks: '',
  note: ''
};

function inferDocumentType(item) {
  const explicit = String(item?.documentType || '').trim();
  if (explicit === 'Resolution' || explicit === 'Ordinance') return explicit;

  const subject = String(item?.subject || '').toLowerCase();
  const controlNumber = String(item?.controlNumber || '').toLowerCase();
  if (subject.includes('ordinance') || controlNumber.includes('ord')) return 'Ordinance';
  return 'Resolution';
}

export default function EditTransmittalPage() {
  const params = useParams();
  const transmittalId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);

  const canEdit = useMemo(() => user && (user.role === 'admin' || user.role === 'encoder'), [user]);
  const controlNumberLabel = form.documentType === 'Ordinance' ? 'Ordinance No.' : 'Resolution No.';

  useEffect(() => {
    const saved = sessionStorage.getItem('transmittal_token') || '';
    const nextToken = saved || COOKIE_TOKEN;
    setToken(nextToken);

    if (!transmittalId) {
      setReady(true);
      return;
    }

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

      const itemRes = await authedRequest(`/api/transmittals/${transmittalId}`, { token: nextToken });
      if (!itemRes.ok) {
        setError(itemRes.data?.error || 'Failed to load transmittal details');
        setReady(true);
        return;
      }

      const item = itemRes.data || {};
      setForm({
        subject: item.subject || '',
        documentType: inferDocumentType(item),
        controlNumber: item.controlNumber || '',
        originOffice: item.originOffice || '',
        targetAgency: item.targetAgency || '',
        status: item.status || 'Created',
        currentHolder: item.currentHolder || '',
        remarks: item.remarks || '',
        note: ''
      });

      setReady(true);
    })();
  }, [transmittalId]);

  async function onSave(e) {
    e.preventDefault();
    if (!canEdit || !transmittalId) return;

    setError('');
    setNotice('');

    const res = await authedRequest(`/api/transmittals/${transmittalId}`, {
      method: 'PATCH',
      token,
      body: form
    });

    if (!res.ok) {
      setError(res.data?.error || 'Failed to update transmittal details');
      return;
    }

    const savedItem = res.data || {};
    setForm((v) => ({
      ...v,
      subject: savedItem.subject || v.subject,
      documentType: savedItem.documentType || v.documentType,
      controlNumber: savedItem.controlNumber || v.controlNumber,
      originOffice: savedItem.originOffice || v.originOffice,
      targetAgency: savedItem.targetAgency || v.targetAgency,
      status: savedItem.status || v.status,
      currentHolder: savedItem.currentHolder || v.currentHolder,
      remarks: savedItem.remarks || '',
      note: ''
    }));
    setNotice(`Transmittal ${transmittalId} updated.`);
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
    <section className="panel">
          <h3>Edit Transmittal</h3>
          <p className="muted"><strong>ID:</strong> {transmittalId || '-'}</p>
          {!canEdit ? <p className="muted">Your role cannot edit transmittal details.</p> : null}
          {error ? <div style={{ color: '#b83a4b', marginTop: '0.4rem' }}>{error}</div> : null}
          {notice ? <div style={{ color: '#1f7a4a', marginTop: '0.4rem' }}>{notice}</div> : null}

          <form className="create-form" onSubmit={onSave}>
            <textarea
              value={form.subject}
              onChange={(e) => setForm((v) => ({ ...v, subject: e.target.value }))}
              placeholder="Subject"
              required
              disabled={!canEdit}
            />
            <label>
              Document Type
              <select value={form.documentType} onChange={(e) => setForm((v) => ({ ...v, documentType: e.target.value }))} disabled={!canEdit}>
                <option>Resolution</option>
                <option>Ordinance</option>
              </select>
            </label>
            <input
              value={form.controlNumber}
              onChange={(e) => setForm((v) => ({ ...v, controlNumber: e.target.value }))}
              placeholder={controlNumberLabel}
              required
              disabled={!canEdit}
            />
            <input
              value={form.originOffice}
              onChange={(e) => setForm((v) => ({ ...v, originOffice: e.target.value }))}
              placeholder="Origin Office"
              required
              disabled={!canEdit || user.role === 'encoder'}
            />
            <input
              value={form.targetAgency}
              onChange={(e) => setForm((v) => ({ ...v, targetAgency: e.target.value }))}
              placeholder="Target Agency"
              required
              disabled={!canEdit}
            />
            <select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))} disabled={!canEdit}>
              <option>Created</option>
              <option>Dispatched</option>
              <option>Received</option>
              <option>In Review</option>
              <option>Completed</option>
            </select>
            <input
              value={form.currentHolder}
              onChange={(e) => setForm((v) => ({ ...v, currentHolder: e.target.value }))}
              placeholder="Current Holder"
              required
              disabled={!canEdit}
            />
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((v) => ({ ...v, remarks: e.target.value }))}
              placeholder="Remarks"
              disabled={!canEdit}
            />
            <textarea
              value={form.note}
              onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))}
              placeholder="History note for this edit (optional)"
              disabled={!canEdit}
            />
            <button type="submit" className="save-user-btn" disabled={!canEdit}>Save Details</button>
            <Link href="/dashboard" className="nav-link">Back to Dashboard</Link>
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
