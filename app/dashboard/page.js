'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  EllipsisVerticalIcon,
  EqualsIcon,
  InboxArrowDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

const COOKIE_TOKEN = '__cookie__';

const emptyTotals = {
  total: 0,
  created: 0,
  dispatched: 0,
  received: 0,
  inReview: 0,
  completed: 0
};

function fmt(value) {
  return new Date(value).toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getDocumentType(item) {
  const subject = String(item?.subject || '').toLowerCase();
  const controlNumber = String(item?.controlNumber || '').toLowerCase();

  if (subject.startsWith('a resolution') || subject.startsWith('resolution')) return 'Resolution';
  if (subject.startsWith('an ordinance') || subject.startsWith('ordinance')) return 'Ordinance';
  if (subject.includes('resolution') && !subject.includes('ordinance')) return 'Resolution';
  if (subject.includes('ordinance') && !subject.includes('resolution')) return 'Ordinance';
  if (controlNumber.includes('reso') || controlNumber.includes('resolution')) return 'Resolution';
  if (controlNumber.includes('ord') || controlNumber.includes('ordinance')) return 'Ordinance';
  return 'Resolution';
}

export default function HomePage() {
  const rowsPerPage = 10;
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [isTokenChecked, setIsTokenChecked] = useState(false);
  const [appBaseUrl, setAppBaseUrl] = useState('');
  const [deepLinkId, setDeepLinkId] = useState('');
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState(emptyTotals);
  const [selectedId, setSelectedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [documentTypeFilter, setDocumentTypeFilter] = useState('All');
  const [error, setError] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const qs = searchParams?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const [filters, setFilters] = useState({ q: '' });
  const [updateForm, setUpdateForm] = useState({
    transmittalId: '',
    status: 'Created',
    office: '',
    agency: '',
    note: '',
    remarks: ''
  });
  useEffect(() => {
    const saved = sessionStorage.getItem('transmittal_token');
    setToken(saved || COOKIE_TOKEN);
    setIsTokenChecked(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setAppBaseUrl(window.location.origin);
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('view');
    if (requestedId) {
      setDeepLinkId(requestedId);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const me = await authedRequest('/api/me', { token });
      if (!me.ok) {
        sessionStorage.removeItem('transmittal_token');
        setToken('');
        setUser(null);
        return;
      }
      if (token === COOKIE_TOKEN) {
        sessionStorage.setItem('transmittal_token', COOKIE_TOKEN);
      }
      setUser(me.data.user);
      setUpdateForm((v) => ({ ...v, office: me.data.user.office, agency: me.data.user.agency }));
    })();
  }, [token]);

  useEffect(() => {
    if (!isTokenChecked) return;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [isTokenChecked, nextPath, router, token]);

  const canUpdate = useMemo(() => user && (user.role === 'admin' || user.role === 'encoder' || user.role === 'viewer'), [user]);
  const canEdit = useMemo(() => user && (user.role === 'admin' || user.role === 'encoder'), [user]);

  async function loadItems() {
    if (!token) return;
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (String(v).trim()) params.set(k, String(v).trim());
    });

    const res = await authedRequest(`/api/transmittals?${params.toString()}`, { token });
    if (!res.ok) {
      setError(res.data?.error || 'Failed to load records');
      return;
    }

    setError('');
    setItems(res.data.items || []);
    setTotals(res.data.totals || emptyTotals);
    setCurrentPage(1);

    if (selectedId) {
      const exists = (res.data.items || []).some((x) => x.id === selectedId);
      if (!exists) setSelectedId(null);
    }
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      loadItems();
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, token]);

  useEffect(() => {
    const selected = items.find((x) => x.id === selectedId);
    if (!selected) return;
    setUpdateForm((v) => ({
      ...v,
      transmittalId: selected.id,
      status: user?.role === 'viewer' ? 'Received' : (selected.status || 'Created'),
      remarks: selected.remarks || '',
      note: ''
    }));
  }, [selectedId, items, user]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, rowsPerPage, documentTypeFilter, items]);

  useEffect(() => {
    if (!deepLinkId || !token || !user || !items.length) return;
    const target = items.find((x) => x.id === deepLinkId);
    if (!target) return;
    setSelectedId(target.id);
    setIsHistoryModalOpen(true);
    setDeepLinkId('');
  }, [deepLinkId, token, user, items]);

  async function onUpdate(e) {
    e.preventDefault();
    if (!canUpdate) return;

    if (!updateForm.transmittalId) {
      setError('Select a transmittal first.');
      return;
    }

    const statusToSend = user?.role === 'viewer' ? 'Received' : updateForm.status;
    const officeToSend = user?.role === 'viewer' ? user.office : updateForm.office;
    const agencyToSend = user?.role === 'viewer' ? user.agency : updateForm.agency;
    const res = await authedRequest(`/api/transmittals/${updateForm.transmittalId}/status`, {
      method: 'PATCH',
      token,
      body: {
        status: statusToSend,
        office: officeToSend,
        agency: agencyToSend,
        note: updateForm.note,
        remarks: updateForm.remarks
      }
    });

    if (!res.ok) {
      setError(res.data?.error || 'Failed to update status');
      return;
    }

    setUpdateForm((v) => ({ ...v, note: '' }));
    setError('');
    await loadItems();
  }

  const filteredItems = useMemo(() => {
    if (documentTypeFilter === 'All') return items;
    return items.filter((item) => getDocumentType(item) === documentTypeFilter);
  }, [items, documentTypeFilter]);

  const selected = items.find((x) => x.id === selectedId);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageItems = filteredItems.slice(pageStart, pageStart + rowsPerPage);
  const statusSeries = useMemo(() => ([
    { key: 'created', label: 'Created', value: totals.created || 0, tone: 'created' },
    { key: 'dispatched', label: 'Dispatched', value: totals.dispatched || 0, tone: 'dispatched' },
    { key: 'received', label: 'Received', value: totals.received || 0, tone: 'received' },
    { key: 'inReview', label: 'In Review', value: totals.inReview || 0, tone: 'review' },
    { key: 'completed', label: 'Completed', value: totals.completed || 0, tone: 'completed' }
  ]), [totals]);
  const completionRate = totals.total ? Math.round(((totals.completed || 0) / totals.total) * 100) : 0;
  const recentItems = useMemo(() => items.slice(0, 6), [items]);
  
  const [postingRows, setPostingRows] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loadPostingRows = () => {
      const stored = localStorage.getItem('posting_rows');
      if (!stored) {
        setPostingRows([]);
        return;
      }
      try {
        const parsed = JSON.parse(stored);
        setPostingRows(Array.isArray(parsed) ? parsed : []);
      } catch {
        setPostingRows([]);
      }
    };

    loadPostingRows();
    const onStorage = (event) => {
      if (event.key === 'posting_rows') loadPostingRows();
    };
    const onPostingUpdated = () => loadPostingRows();
    window.addEventListener('storage', onStorage);
    window.addEventListener('posting_rows_updated', onPostingUpdated);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('posting_rows_updated', onPostingUpdated);
    };
  }, []);

  const latestPostedRows = useMemo(() => {
    const posted = postingRows
      .map((row, index) => {
        const raw = String(row?.datePostedRaw || '').trim();
        const ts = raw ? Date.parse(`${raw}T00:00:00`) : NaN;
        return { ...row, _postedTs: Number.isFinite(ts) ? ts : -1, _seq: index };
      })
      .filter((row) => row._postedTs >= 0);
    if (!posted.length) return [];
    posted.sort((a, b) => (b._postedTs - a._postedTs) || ((b.no || 0) - (a.no || 0)) || (b._seq - a._seq));
    return posted.slice(0, 5);
  }, [postingRows]);
  const qrTargetUrl = selected && appBaseUrl ? `${appBaseUrl}/?view=${encodeURIComponent(selected.id)}` : '';
  const qrImageUrl = qrTargetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(qrTargetUrl)}`
    : '';

  if (!isTokenChecked || !token || (token && !user)) {
    return (
      <main style={{ maxWidth: 500, margin: '2rem auto' }}>
        <section className="panel">
          <p className="muted">Checking session...</p>
        </section>
      </main>
    );
  }

  return (
    <>
      {error ? <div style={{ color: '#b83a4b', marginBottom: '0.5rem' }}>{error}</div> : null}
      <section className="panel">
        <div className="dashboard-hero">
          <div className="dashboard-hero-user">
            <span className="dashboard-hero-avatar" aria-hidden="true">
              {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </span>
            <div className="dashboard-hero-user-text">
              <strong>{user?.role ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` : 'User'}</strong>
              <span>{user?.agency || 'to the Sangguniang'}</span>
            </div>
          </div>

          <div className="dashboard-hero-title">
            <h2>Sangguniang Bayan</h2>
            <p>{user?.office || 'Secretary Records Office'}</p>
          </div>

        </div>
          <div className="cards">
            <div className="stat stat-total">
              <span className="stat-icon"><EqualsIcon className="stat-icon-svg" aria-hidden="true" /></span>
              <div className="stat-copy">
                <span className="stat-label">Total Documents</span>
                <strong>{totals.total || 0}</strong>
              </div>
            </div>
            <div className="stat stat-created">
              <span className="stat-icon"><ClipboardDocumentCheckIcon className="stat-icon-svg" aria-hidden="true" /></span>
              <div className="stat-copy">
                <span className="stat-label">Created</span>
                <strong>{totals.created || 0}</strong>
              </div>
            </div>
            <div className="stat stat-dispatched">
              <span className="stat-icon"><ArrowPathIcon className="stat-icon-svg" aria-hidden="true" /></span>
              <div className="stat-copy">
                <span className="stat-label">Dispatched</span>
                <strong>{totals.dispatched || 0}</strong>
              </div>
            </div>
            <div className="stat stat-received">
              <span className="stat-icon"><InboxArrowDownIcon className="stat-icon-svg" aria-hidden="true" /></span>
              <div className="stat-copy">
                <span className="stat-label">Received</span>
                <strong>{totals.received || 0}</strong>
              </div>
            </div>
            <div className="stat stat-done">
              <span className="stat-icon"><CheckCircleIcon className="stat-icon-svg" aria-hidden="true" /></span>
              <div className="stat-copy">
                <span className="stat-label">Completed</span>
                <strong>{totals.completed || 0}</strong>
              </div>
            </div>
          </div>

          <div className="dashboard-insights">
            <section className="dashboard-insight-card latest-posted-card">
              <div className="dashboard-insight-head">
                <h3>Status Distribution</h3>
                <span>{completionRate}% complete</span>
              </div>
              <p className="muted">
                {totals.completed || 0} of {totals.total || 0} transmittals are completed.
              </p>
              <div className="dashboard-status-chart">
                {statusSeries.map((status) => {
                  const width = totals.total ? Math.max(4, Math.round((status.value / totals.total) * 100)) : 0;
                  return (
                    <div key={status.key} className="dashboard-status-row">
                      <div className="dashboard-status-meta">
                        <span>{status.label}</span>
                        <strong>{status.value}</strong>
                      </div>
                      <div className="dashboard-status-track">
                        <span className={`dashboard-status-fill ${status.tone}`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="dashboard-insight-card dashboard-insight-recent doclist-template">
              <div className="dashboard-insight-head">
                <h3>Recent Transmittals</h3>
                <span>{recentItems.length} shown</span>
              </div>
              <div className="table-wrap dashboard-insight-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Reso/Ord No.</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th>Current Holder</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentItems.length ? recentItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.controlNumber || '-'}</td>
                        <td>{item.subject}</td>
                        <td><span className={`badge status-${String(item.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{item.status}</span></td>
                        <td>{item.currentHolder || '-'}</td>
                        <td>{item.updatedAt ? fmt(item.updatedAt) : '-'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5}>No transmittals found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="dashboard-insight-card dashboard-insight-wide latest-posted-card">
              <div className="dashboard-insight-head">
                <h3>Latest Posted</h3>
                <span>Posting Log</span>
              </div>
              {latestPostedRows.length ? (
                <div className="dashboard-attention-list">
                  {latestPostedRows.map((row, index) => (
                    <div className="dashboard-attention-row" key={`${row.no || row.docNo}-${index}`}>
                      <div className="dashboard-attention-main">
                        <strong>{row.docNo || 'Document'}</strong>
                        <span>{row.title || 'Untitled'}</span>
                      </div>
                      <div className="dashboard-attention-meta">
                        <span className="badge">{row.status || 'Posted'}</span>
                        <span>{row.location || '-'}</span>
                        <span>{row.datePosted || '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No posting records yet.</p>
              )}
            </section>
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
