'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentCheckIcon,
  BuildingOffice2Icon,
  BellIcon,
  EllipsisVerticalIcon,
  EqualsIcon,
  FunnelIcon,
  IdentificationIcon,
  InboxArrowDownIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  ShieldCheckIcon,
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

const emptyEditForm = {
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

function inferDocumentType(item) {
  const explicit = String(item?.documentType || '').trim();
  if (explicit === 'Resolution' || explicit === 'Ordinance') return explicit;
  return getDocumentType(item);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getLatestDispatchEntry(item) {
  const history = Array.isArray(item?.history) ? item.history : [];
  let latest = null;
  history.forEach((entry) => {
    const status = normalizeText(entry?.status);
    if (status !== 'dispatched') return;
    const t = Date.parse(String(entry?.timestamp || ''));
    if (!Number.isFinite(t)) return;
    if (!latest || t > latest.timestamp) {
      latest = { entry, timestamp: t };
    }
  });
  return latest;
}

function matchesRecipient(item, user) {
  const office = normalizeText(user?.office);
  const agency = normalizeText(user?.agency);
  if (!office && !agency) return false;
  const latest = getLatestDispatchEntry(item);
  if (!latest) return false;
  const recipientOffice = normalizeText(latest.entry?.recipientOffice);
  const recipientAgency = normalizeText(latest.entry?.recipientAgency);
  if (office && recipientOffice) return recipientOffice === office;
  if (agency && recipientAgency) return recipientAgency === agency;
  return false;
}

function isFromRecordsOffice(item) {
  return normalizeText(item?.originOffice).includes('records');
}

function getRecordsDispatchMsForUser(item, user) {
  const office = normalizeText(user?.office);
  const agency = normalizeText(user?.agency);
  if (!office && !agency) return 0;
  const latest = getLatestDispatchEntry(item);
  if (!latest) return 0;
  const recipientOffice = normalizeText(latest.entry?.recipientOffice);
  const recipientAgency = normalizeText(latest.entry?.recipientAgency);
  if (office && recipientOffice !== office) return 0;
  if (agency && recipientAgency !== agency) return 0;
  return latest.timestamp || 0;
}

function getSeenKey(user) {
  const u = String(user?.username || '').trim();
  return u ? `transmittal_dispatched_seen_ms:${u}` : 'transmittal_dispatched_seen_ms';
}

export default function HomePage() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [isTokenChecked, setIsTokenChecked] = useState(false);
  const [appBaseUrl, setAppBaseUrl] = useState('');
  const [deepLinkId, setDeepLinkId] = useState('');
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState(emptyTotals);
  const [selectedId, setSelectedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [documentTypeFilter, setDocumentTypeFilter] = useState('All');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState('');
  const [editNotice, setEditNotice] = useState('');
  const userMenuRef = useRef(null);
  const [bellSelectedMap, setBellSelectedMap] = useState({});
  const [lastSeenDispatchedMs, setLastSeenDispatchedMs] = useState(0);
  const [isBellOpen, setIsBellOpen] = useState(false);

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
  const [editForm, setEditForm] = useState(emptyEditForm);
  useEffect(() => {
    const saved = sessionStorage.getItem('transmittal_token');
    setToken(saved || COOKIE_TOKEN);
    setIsTokenChecked(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user) return;
    const stored = Number(localStorage.getItem(getSeenKey(user)) || 0);
    setLastSeenDispatchedMs(Number.isFinite(stored) ? stored : 0);
  }, [user]);

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

  const canCreate = useMemo(() => user && (user.role === 'admin' || user.role === 'encoder'), [user]);
  const canUpdate = useMemo(() => user && (user.role === 'admin' || user.role === 'encoder' || user.role === 'viewer'), [user]);
  const canEdit = useMemo(() => user && (user.role === 'admin' || user.role === 'encoder'), [user]);
  const isAdmin = useMemo(() => user && user.role === 'admin', [user]);

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
    setLastSeenDispatchedMs(latestDispatchedForUserMs);
    localStorage.setItem(getSeenKey(user), String(latestDispatchedForUserMs));
    setDeepLinkId('');
  }, [deepLinkId, token, user, items]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!isUserMenuOpen) return;
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(''), 2200);
    return () => clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!isEditModalOpen || !editTargetId || !token) return;

    (async () => {
      const itemRes = await authedRequest(`/api/transmittals/${editTargetId}`, { token });
      if (!itemRes.ok) {
        setError(itemRes.data?.error || 'Failed to load transmittal details');
        return;
      }

      const item = itemRes.data || {};
      setEditForm({
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
    })();
  }, [isEditModalOpen, editTargetId, token]);

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

  async function onBellReceive() {
    if (user?.role !== 'viewer') return;
    setSuccessMessage('');
    const ids = dispatchedForUserRows.filter((row) => bellSelectedMap[row.id]).map((row) => row.id);
    if (!ids.length) {
      setError('Select at least one transmittal first.');
      return;
    }

    const res = await authedRequest('/api/transmittals/bulk-status', {
      method: 'POST',
      token,
      body: {
        ids,
        status: 'Received',
        office: user.office,
        agency: user.agency,
        note: `Bulk received by ${user.username}`
      }
    });

    if (!res.ok) {
      setError(res.data?.error || 'Failed to receive selected files');
      return;
    }
    setError('');
    setSuccessMessage('Received');
    setBellSelectedMap({});
    setLastSeenDispatchedMs(latestDispatchedForUserMs);
    localStorage.setItem(getSeenKey(user), String(latestDispatchedForUserMs));
    setIsBellOpen(false);
    await loadItems();
  }

  async function onSaveEdit(e) {
    e.preventDefault();
    if (!canEdit || !editTargetId) return;

    setError('');
    setEditNotice('');

    const res = await authedRequest(`/api/transmittals/${editTargetId}`, {
      method: 'PATCH',
      token,
      body: editForm
    });

    if (!res.ok) {
      setError(res.data?.error || 'Failed to update transmittal details');
      return;
    }

    const savedItem = res.data || {};
    setEditForm((v) => ({
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
    setEditNotice(`Transmittal ${editTargetId} updated.`);
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
  const userInitial = user?.username ? user.username.charAt(0).toUpperCase() : 'U';
  const qrTargetUrl = selected && appBaseUrl ? `${appBaseUrl}/dashboard/documents?view=${encodeURIComponent(selected.id)}` : '';
  const qrImageUrl = qrTargetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(qrTargetUrl)}`
    : '';
  const editControlNumberLabel = editForm.documentType === 'Ordinance' ? 'Ordinance No.' : 'Resolution No.';
  const dispatchedForUserRows = useMemo(
    () => items.filter((item) => String(item.status || '').toLowerCase() === 'dispatched' && matchesRecipient(item, user) && isFromRecordsOffice(item)),
    [items, user]
  );
  const latestDispatchedForUserMs = useMemo(
    () => dispatchedForUserRows.reduce((max, item) => Math.max(max, getRecordsDispatchMsForUser(item, user)), 0),
    [dispatchedForUserRows, user]
  );
  const bellSelectedCount = dispatchedForUserRows.filter((row) => bellSelectedMap[row.id]).length;
  const bellAllSelected = dispatchedForUserRows.length > 0 && bellSelectedCount === dispatchedForUserRows.length;
  const hasNewDispatch = user?.role === 'viewer' && dispatchedForUserRows.length > 0;

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
      {successMessage ? (
        <div
          style={{
            position: 'fixed',
            top: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1200,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: '#e9f8ee',
            color: '#1f7a3a',
            border: '1px solid #9fddad',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
          }}
        >
          <CheckCircleIcon style={{ width: '20px', height: '20px' }} aria-hidden="true" />
          <strong>{successMessage}</strong>
        </div>
      ) : null}
      {error ? <div style={{ color: '#b83a4b', marginBottom: '0.5rem' }}>{error}</div> : null}
      <section className="panel doclist-template">
          <div className="doclist-top-action">
            {user.role === 'viewer' ? (
              <>
                <div className="doclist-bell-wrap">
                  <button
                    type="button"
                    className="doclist-export-btn doclist-bell-btn"
                    onClick={() => setIsBellOpen((v) => !v)}
                    aria-label="Transmittal notifications"
                    title="Transmittal notifications"
                    aria-expanded={isBellOpen}
                  >
                    <BellIcon className="doclist-toolbar-icon" aria-hidden="true" />
                    {hasNewDispatch ? <span className="doclist-bell-dot" aria-hidden="true" /> : null}
                  </button>
                </div>
              </>
              ) : null}
            {canCreate ? (
              <Link href="/dashboard/transmittals/new" className="doclist-export-btn" aria-label="Add Subject">
                <PlusIcon className="doclist-toolbar-icon" aria-hidden="true" />
                <span>Add E-copy</span>
              </Link>
            ) : null}
          </div>
          {isBellOpen ? (
            <div className="history-modal-overlay" onClick={() => setIsBellOpen(false)}>
              <section
                className="panel history-modal doclist-template"
                style={{ width: 'min(720px, calc(100vw - 2rem))' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="history-close-btn"
                  onClick={() => setIsBellOpen(false)}
                  aria-label="Close notifications"
                >
                  <XMarkIcon className="history-close-icon" aria-hidden="true" />
                </button>
                <h3 style={{ marginTop: 0 }}>Dispatched to your office</h3>
                {dispatchedForUserRows.length ? (
                  <>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th className="auto-letter-check-col">
                              <input
                                type="checkbox"
                                checked={bellAllSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setBellSelectedMap(() => {
                                    if (!checked) return {};
                                    const next = {};
                                    dispatchedForUserRows.forEach((row) => {
                                      next[row.id] = true;
                                    });
                                    return next;
                                  });
                                }}
                                aria-label="Select all dispatched items"
                              />
                            </th>
                            <th>Reso/Ord No.</th>
                            <th>Subject</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dispatchedForUserRows.map((row) => (
                            <tr key={`bell-${row.id}`}>
                              <td className="auto-letter-check-col">
                                <input
                                  className="auto-letter-mini-check"
                                  type="checkbox"
                                  checked={!!bellSelectedMap[row.id]}
                                  onChange={() => setBellSelectedMap((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                                  aria-label={`Select ${row.controlNumber || row.id}`}
                                />
                              </td>
                              <td>
                                {(getDocumentType(row) === 'Ordinance' ? 'ORDINANCE' : 'RESOLUTION')} NO. {row.controlNumber || '-'}
                              </td>
                              <td>{row.subject || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button
                        type="button"
                        className="doclist-export-btn"
                        onClick={onBellReceive}
                        disabled={!bellSelectedCount}
                      >
                        Receive Selected ({bellSelectedCount})
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="muted">No dispatched items.</p>
                )}
              </section>
            </div>
          ) : null}
          <div className="search-header-row">
            <div className="doclist-toolbar-left">
              <label className="search-box" style={{ marginBottom: 0 }}>
                <MagnifyingGlassIcon className="sidebar-ico-svg search-ico-svg" aria-hidden="true" />
                <input
                  className="search-field"
                  value={filters.q}
                  onChange={(e) => setFilters((v) => ({ ...v, q: e.target.value }))}
                  placeholder="Search"
                />
              </label>
              <button type="button" className="doclist-toolbar-btn" aria-label="Filter">
                <FunnelIcon className="doclist-toolbar-icon" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <span>Document Type</span>
                    <select
                      className="doc-type-filter"
                      value={documentTypeFilter}
                      onChange={(e) => {
                        setDocumentTypeFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      aria-label="Filter by document type"
                    >
                      <option value="All">All</option>
                      <option value="Resolution">Resolution</option>
                      <option value="Ordinance">Ordinance</option>
                    </select>
                  </th>
                  <th>Reso/Ord No.</th>
                  <th>Subject</th>
                  <th>Origin</th>
                  <th>Status</th>
                  <th>Current Holder</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <tr key={item.id}>
                    <td><span className={`doc-type-chip ${getDocumentType(item).toLowerCase()}`}>{getDocumentType(item)}</span></td>
                    <td>{item.controlNumber}</td>
                    <td>{item.subject}</td>
                    <td>{item.originOffice}</td>
                    <td><span className={`badge status-${String(item.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{item.status}</span></td>
                    <td>{item.currentHolder}</td>
                    <td className="action-cell">
                      <Link
                        href={`/dashboard/documents/${item.id}`}
                        className="action-icon-btn"
                        aria-label={`View ${item.id}`}
                        title="View"
                      >
                        <EllipsisVerticalIcon className="action-icon-svg" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pager" aria-label="Transmittal table pagination">
              <button
                type="button"
                className="pager-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                &lt;
              </button>
              <span className="pager-info">{currentPage} / {totalPages}</span>
              <button
                type="button"
                className="pager-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                &gt;
              </button>
              <div className="doclist-pager-right">
                <span>Show</span>
                <select
                  className="doclist-rows-btn"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Rows per page"
                >
                  <option value={10}>10 Rows</option>
                  <option value={25}>25 Rows</option>
                  <option value={50}>50 Rows</option>
                  <option value={100}>100 Rows</option>
                </select>
              </div>
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
