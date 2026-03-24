'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUpTrayIcon, EyeIcon } from '@heroicons/react/24/outline';

const COOKIE_TOKEN = '__cookie__';

const seedRows = [
  
];

export default function PostingPage() {
  const searchParams = useSearchParams();
  const preselectId = searchParams?.get('docId') || '';
  const autoAdd = searchParams?.get('add') === '1' && !!preselectId;
  const [rows, setRows] = useState(seedRows);
  const [rowsReady, setRowsReady] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const fileInputRef = useRef(null);
  const [pendingUploadNo, setPendingUploadNo] = useState(null);
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [docRows, setDocRows] = useState([]);
  const [docSelectedMap, setDocSelectedMap] = useState({});
  const [docSearch, setDocSearch] = useState('');
  const [form, setForm] = useState({
    dateApproved: '',
    dateReceived: '',
    datePosted: '',
    location: '',
    postedBy: '',
    status: 'Posted'
  });

  useEffect(() => {
    const saved = sessionStorage.getItem('transmittal_token') || '';
    setToken(saved || COOKIE_TOKEN);
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const res = await authedRequest('/api/me', { token });
      if (!res.ok) return;
      if (token === COOKIE_TOKEN) {
        sessionStorage.setItem('transmittal_token', COOKIE_TOKEN);
      }
      setUser(res.data?.user || null);
    })();
  }, [token]);

  useEffect(() => {
    if (autoAdd) {
      setIsAdding(true);
    }
  }, [autoAdd]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('posting_rows');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          setRows(parsed);
        }
      } catch {
        // ignore malformed cache
      }
    }
    setRowsReady(true);
  }, []);

  useEffect(() => {
    if (!rowsReady) return;
    localStorage.setItem('posting_rows', JSON.stringify(rows));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('posting_rows_updated'));
    }
  }, [rows, rowsReady]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const res = await authedRequest('/api/transmittals', { token });
      if (!res.ok) return;
      const normalized = (res.data?.items || []).map((item) => ({
        id: item.id,
        docNo: `${inferDocumentType(item)} No. ${String(item.controlNumber || '-').trim()}`,
        title: String(item.subject || '').trim()
      })).filter((row) => row.title || row.docNo);
      setDocRows(normalized);
    })();
  }, [token]);

  useEffect(() => {
    if (!autoAdd || !preselectId || !docRows.length) return;
    const matched = docRows.find((row) => row.id === preselectId);
    if (!matched) return;
    setDocSelectedMap({ [preselectId]: true });
  }, [autoAdd, preselectId, docRows]);

  const selectedDocs = useMemo(
    () => docRows.filter((row) => docSelectedMap[row.id]),
    [docRows, docSelectedMap]
  );
  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return docRows;
    return docRows.filter((row) =>
      `${row.docNo} ${row.title}`.toLowerCase().includes(q)
    );
  }, [docRows, docSearch]);
  const preselectedDoc = useMemo(
    () => (autoAdd ? docRows.find((row) => row.id === preselectId) : null),
    [autoAdd, docRows, preselectId]
  );

  function inferDocumentType(item) {
    const explicit = String(item?.documentType || '').trim();
    if (explicit === 'Resolution' || explicit === 'Ordinance') return explicit;
    const subject = String(item?.subject || '').toLowerCase();
    const controlNumber = String(item?.controlNumber || '').toLowerCase();
    if (subject.includes('ordinance') || controlNumber.includes('ord')) return 'Ordinance';
    return 'Resolution';
  }

  function fmtDate(value) {
    if (!value) return '-';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  function onAddPosting() {
    setIsAdding(true);
  }

  function onCancelAdd() {
    setIsAdding(false);
    if (!autoAdd) {
      setDocSelectedMap({});
      setDocSearch('');
    }
    setForm({
      dateApproved: '',
      dateReceived: '',
      datePosted: '',
      location: '',
      postedBy: '',
      status: 'Posted'
    });
  }

  function onSavePosting(e) {
    e.preventDefault();
    if (!selectedDocs.length) return;
    setRows((prev) => {
      let nextNo = prev.length ? Math.max(...prev.map((r) => r.no)) + 1 : 1;
      const additions = selectedDocs.map((doc) => ({
        no: nextNo++,
        docNo: doc.docNo,
        title: doc.title || '-',
        dateApproved: fmtDate(form.dateApproved),
        dateApprovedRaw: form.dateApproved || '',
        dateReceived: fmtDate(form.dateReceived),
        dateReceivedRaw: form.dateReceived || '',
        datePosted: form.datePosted ? fmtDate(form.datePosted) : 'Pending',
        datePostedRaw: form.datePosted || '',
        location: form.location || '-',
        postedBy: form.postedBy || '-',
        status: form.status || 'Pending',
        remarks: '-',
        proofImage: ''
      }));
      return [...prev, ...additions];
    });
    onCancelAdd();
  }

  const orderedRows = useMemo(
    () => rows.slice().sort((a, b) => (b.no || 0) - (a.no || 0)),
    [rows]
  );
  const canUpload = user && (user.role === 'admin' || user.role === 'encoder');

  function onPickUpload(rowNo) {
    setPendingUploadNo(rowNo);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  function onUploadFile(e) {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadNo) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setRows((prev) =>
        prev.map((row) =>
          row.no === pendingUploadNo ? { ...row, proofImage: dataUrl } : row
        )
      );
      setPendingUploadNo(null);
    };
    reader.readAsDataURL(file);
  }

  function onViewImage(row) {
    if (!row.proofImage) return;
    setViewImage(row.proofImage);
  }

  return (
    <section className="panel doclist-template">
      <div className="doclist-top-action" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <h3 style={{ margin: 0 }}>POSTING LOG FOR RESOLUTIONS / ORDINANCES</h3>
          <p className="muted" style={{ margin: 0 }}>Office of the Secretary to the Sangguniang Bayan</p>
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          filter: isAdding ? 'blur(3px)' : 'none',
          pointerEvents: isAdding ? 'none' : 'auto'
        }}
      >
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Resolution / Ordinance No.</th>
              <th>Title / Subject</th>
              <th>Date Approved</th>
              <th>Date Received by Office</th>
              <th>Date Posted</th>
              <th>Posting Location</th>
              <th>Posted By</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((row) => (
              <tr key={row.no}>
                <td>{row.docNo}</td>
                <td>{row.title}</td>
                <td>{row.dateApproved}</td>
                <td>{row.dateReceived}</td>
                <td>{row.datePosted}</td>
                <td>{row.location}</td>
                <td>{row.postedBy}</td>
                <td>{row.status}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="action-icon-btn"
                      title="View"
                      aria-label="View posted image"
                      onClick={() => onViewImage(row)}
                      disabled={!row.proofImage}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: '0.5rem',
                          height: '0.5rem',
                          borderRadius: '999px',
                          background: row.proofImage ? '#16a34a' : '#ef4444',
                          display: 'inline-block',
                          marginRight: '0.35rem'
                        }}
                      />
                      <EyeIcon className="action-icon-svg" aria-hidden="true" />
                    </button>
                    {canUpload ? (
                      <button
                        type="button"
                        className="action-icon-btn"
                        title="Upload"
                        aria-label="Upload posted image"
                        onClick={() => onPickUpload(row.no)}
                      >
                        <ArrowUpTrayIcon className="action-icon-svg" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onUploadFile}
      />
      {isAdding ? (
        <div className="history-modal-overlay" onClick={onCancelAdd}>
          <section
            className="panel history-modal doclist-template"
            style={{ width: 'min(900px, calc(100vw - 2rem))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="doclist-top-action" style={{ justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0 }}>Add Posting</h4>
              <button type="button" className="doclist-export-btn" onClick={onCancelAdd}>Close</button>
            </div>
            {autoAdd ? (
              <div style={{ border: '1px solid #eceff4', borderRadius: '12px', padding: '0.85rem 1rem', background: '#ffffff' }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>Selected Document</p>
                <p style={{ margin: '0.35rem 0 0', color: '#4b5563' }}>
                  {preselectedDoc ? preselectedDoc.docNo : 'Loading document...'}
                </p>
                {preselectedDoc ? (
                  <p style={{ margin: '0.2rem 0 0', color: '#4b5563' }}>{preselectedDoc.title || '-'}</p>
                ) : null}
              </div>
            ) : (
              <div className="auto-letter-mini-table-wrap">
                <div className="auto-letter-mini-search-row">
                  <label className="search-box auto-letter-mini-search">
                    <input
                      className="search-field"
                      placeholder="SEARCH..."
                      value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                    />
                  </label>
                </div>
                <table className="auto-letter-mini-table">
                  <thead>
                    <tr>
                      <th>Resolution / Ordinance No.</th>
                      <th className="auto-letter-check-col">Use</th>
                      <th>Title / Subject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.length ? filteredDocs.map((row) => (
                      <tr key={row.id}>
                        <td>{row.docNo}</td>
                        <td className="auto-letter-check-col">
                          <input
                            className="auto-letter-mini-check"
                            type="checkbox"
                            checked={!!docSelectedMap[row.id]}
                            onChange={() => setDocSelectedMap((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                            aria-label={`Include ${row.docNo}`}
                          />
                        </td>
                        <td>{row.title || '-'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3}>No documents available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <form className="update-form" onSubmit={onSavePosting} style={{ marginTop: '1rem' }}>
              <label>
                Date Approved
                <input
                  type="date"
                  value={form.dateApproved}
                  onChange={(e) => setForm((v) => ({ ...v, dateApproved: e.target.value }))}
                  required
                />
              </label>
              <label>
                Date Received by Office
                <input
                  type="date"
                  value={form.dateReceived}
                  onChange={(e) => setForm((v) => ({ ...v, dateReceived: e.target.value }))}
                  required
                />
              </label>
              <label>
                Date Posted
                <input
                  type="date"
                  value={form.datePosted}
                  onChange={(e) => setForm((v) => ({ ...v, datePosted: e.target.value }))}
                />
              </label>
              <input
                value={form.location}
                onChange={(e) => setForm((v) => ({ ...v, location: e.target.value }))}
                placeholder="Posting Location"
              />
              <input
                value={form.postedBy}
                onChange={(e) => setForm((v) => ({ ...v, postedBy: e.target.value }))}
                placeholder="Posted By"
              />
              <select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>
                <option>Posted</option>
                <option>Pending</option>
              </select>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="doclist-export-btn" onClick={onCancelAdd}>Cancel</button>
                <button type="submit" className="doclist-export-btn" disabled={!selectedDocs.length}>Save Posting</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {viewImage ? (
        <div className="history-modal-overlay" onClick={() => setViewImage(null)}>
          <section
            className="panel history-modal doclist-template"
            style={{ width: 'min(900px, calc(100vw - 2rem))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="doclist-top-action" style={{ justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0 }}>Posted Image</h4>
              <button type="button" className="doclist-export-btn" onClick={() => setViewImage(null)}>Close</button>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <img src={viewImage} alt="Posted document" style={{ width: '100%', borderRadius: '12px' }} />
            </div>
          </section>
        </div>
      ) : null}
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
