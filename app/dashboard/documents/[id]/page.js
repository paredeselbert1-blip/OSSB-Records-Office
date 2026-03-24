'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PencilSquareIcon } from '@heroicons/react/24/outline';

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

const emptyPostingForm = {
  dateApproved: '',
  dateReceived: '',
  datePosted: '',
  location: '',
  postedBy: '',
  status: 'Posted'
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

function isLetterHistoryEntry(entry) {
  return String(entry?.note || '').toLowerCase().includes('auto letter');
}

function inferDocumentType(item) {
  const explicit = String(item?.documentType || '').trim();
  if (explicit === 'Resolution' || explicit === 'Ordinance') return explicit;

  const subject = String(item?.subject || '').toLowerCase();
  const controlNumber = String(item?.controlNumber || '').toLowerCase();
  if (subject.includes('ordinance') || controlNumber.includes('ord')) return 'Ordinance';
  return 'Resolution';
}

function fmtShortDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export default function DocumentDetailPage() {
  const params = useParams();
  const transmittalId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [item, setItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewerEditing, setIsViewerEditing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isPrintHistoryOpen, setIsPrintHistoryOpen] = useState(false);
  const [printHistoryRows, setPrintHistoryRows] = useState([]);
  const [printHistoryTime, setPrintHistoryTime] = useState('');
  const [printHistoryError, setPrintHistoryError] = useState('');
  const [isPrintHistoryLoading, setIsPrintHistoryLoading] = useState(false);
  const [printLetterMeta, setPrintLetterMeta] = useState({
    recipientName: '',
    recipientTitle: '',
    recipientOffice: '',
    salutation: '',
    displayDate: ''
  });
  const [form, setForm] = useState(emptyForm);
  const [isUploadingLetter, setIsUploadingLetter] = useState(false);
  const [isAddingPosting, setIsAddingPosting] = useState(false);
  const [postingForm, setPostingForm] = useState(emptyPostingForm);
  const [copyFurnishList, setCopyFurnishList] = useState([]);
  const [copyFurnishInput, setCopyFurnishInput] = useState('');
  const [editingUploadId, setEditingUploadId] = useState('');
  const [editingUploadRemarks, setEditingUploadRemarks] = useState('');
  const [isSavingUploadRemarks, setIsSavingUploadRemarks] = useState(false);
  const letterUploadInputRef = useRef(null);
  const noticeTimeoutRef = useRef(null);

  const canEdit = useMemo(() => user && (user.role === 'admin' || user.role === 'encoder'), [user]);
  const canReceive = useMemo(() => user && user.role === 'viewer', [user]);
  const controlNumberLabel = form.documentType === 'Ordinance' ? 'Ordinance No.' : 'Resolution No.';
  const historyRows = useMemo(() => (item?.history || []).slice().reverse(), [item]);
  const letterHistoryRows = useMemo(
    () => historyRows.filter((entry) => isLetterHistoryEntry(entry)),
    [historyRows]
  );
  const systemHistoryRows = useMemo(
    () => historyRows.filter((entry) => !isLetterHistoryEntry(entry)),
    [historyRows]
  );
  const uploadedLetterRows = useMemo(
    () => (item?.letterUploads || []).slice().reverse(),
    [item]
  );

  async function loadItem(savedToken) {
    if (!savedToken || !transmittalId) return;
    const res = await authedRequest(`/api/transmittals/${transmittalId}`, { token: savedToken });
    if (!res.ok) {
      setError(res.data?.error || 'Failed to load transmittal details');
      return;
    }

    const next = res.data || null;
    setItem(next);
    setForm({
      subject: next?.subject || '',
      documentType: inferDocumentType(next),
      controlNumber: next?.controlNumber || '',
      originOffice: next?.originOffice || '',
      targetAgency: next?.targetAgency || '',
      status: next?.status || 'Created',
      currentHolder: next?.currentHolder || '',
      remarks: next?.remarks || '',
      note: ''
    });
    setCopyFurnishList(Array.isArray(next?.copyFurnish) ? next.copyFurnish : []);
  }

  function onOpenPostingForm() {
    setNotice('');
    setError('');
    setIsAddingPosting(true);
  }

  function onCancelPostingForm() {
    setIsAddingPosting(false);
    setPostingForm(emptyPostingForm);
  }

  function onSavePosting(e) {
    e.preventDefault();
    if (!item) return;
    if (typeof window === 'undefined') return;

    const docType = inferDocumentType(item);
    const docNo = `${docType} No. ${String(item.controlNumber || '-').trim()}`;
    const title = String(item.subject || '').trim() || '-';

    const stored = localStorage.getItem('posting_rows');
    let rows = [];
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) rows = parsed;
      } catch {
        rows = [];
      }
    }

    const nextNo = rows.length ? Math.max(...rows.map((r) => r.no || 0)) + 1 : 1;
    const nextRow = {
      no: nextNo,
      docNo,
      title,
      dateApproved: fmtShortDate(postingForm.dateApproved),
      dateApprovedRaw: postingForm.dateApproved || '',
      dateReceived: fmtShortDate(postingForm.dateReceived),
      dateReceivedRaw: postingForm.dateReceived || '',
      datePosted: postingForm.datePosted ? fmtShortDate(postingForm.datePosted) : 'Pending',
      datePostedRaw: postingForm.datePosted || '',
      location: postingForm.location || '-',
      postedBy: postingForm.postedBy || '-',
      status: postingForm.status || 'Pending',
      remarks: '-'
    };

    localStorage.setItem('posting_rows', JSON.stringify([...rows, nextRow]));
    window.dispatchEvent(new Event('posting_rows_updated'));
    setNotice('Posting saved.');
    onCancelPostingForm();
  }

  function isSameMinute(a, b) {
    const ta = Date.parse(String(a || ''));
    const tb = Date.parse(String(b || ''));
    if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
    return Math.floor(ta / 60000) === Math.floor(tb / 60000);
  }

  function getLetterMetaFromEntry(entry) {
    const note = String(entry?.note || '');
    const match = note.match(/Auto letter generated for (.+?) \((.+?)\) on (.+?)\./i);
    const recipientOffice = (match?.[2] || entry?.recipientOffice || entry?.recipientAgency || '').trim();
    const recipientName = (match?.[1] || '').trim();
    const displayDate = (match?.[3] || '').trim();
    const isMayorOffice = recipientOffice.toLowerCase().includes('mayor');
    const finalRecipientName = recipientName || (isMayorOffice ? 'HON. NORBERT LIM' : 'HON. ____________________');
    const recipientTitle = isMayorOffice ? 'Municipal Mayor' : 'Office/Title';
    const finalDisplayDate = displayDate || (entry?.timestamp ? fmt(entry.timestamp) : '');
    const salutation = isMayorOffice ? 'Dear Mayor Lim;' : 'Dear Sir/Madam;';
    return {
      recipientName: finalRecipientName,
      recipientTitle,
      recipientOffice: recipientOffice || 'This Office',
      salutation,
      displayDate: finalDisplayDate
    };
  }

  async function onOpenPrintHistory(targetTimestamp) {
    if (!token) return;
    setPrintHistoryError('');
    setIsPrintHistoryOpen(true);
    setIsPrintHistoryLoading(true);
    setPrintHistoryTime(targetTimestamp);
    setPrintLetterMeta({
      recipientName: '',
      recipientTitle: '',
      recipientOffice: '',
      salutation: '',
      displayDate: ''
    });

    const res = await authedRequest('/api/transmittals', { token });
    if (!res.ok) {
      setPrintHistoryError(res.data?.error || 'Failed to load transmittals.');
      setIsPrintHistoryLoading(false);
      return;
    }

    const allItems = res.data?.items || [];
    const matches = [];
    allItems.forEach((t) => {
      const history = Array.isArray(t.history) ? t.history : [];
      const matchingEntry = history.find((entry) =>
        isLetterHistoryEntry(entry) && isSameMinute(entry.timestamp, targetTimestamp)
      );
      if (matchingEntry) {
        matches.push({ item: t, entry: matchingEntry });
      }
    });
    setPrintHistoryRows(matches);
    if (matches.length) {
      setPrintLetterMeta(getLetterMetaFromEntry(matches[0].entry));
    }
    setIsPrintHistoryLoading(false);
  }

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
      await loadItem(nextToken);
      setReady(true);
    })();
  }, [transmittalId]);

  async function persistCopyFurnish(nextList) {
    if (!canEdit || !transmittalId) return;
    const res = await authedRequest(`/api/transmittals/${transmittalId}`, {
      method: 'PATCH',
      token,
      body: { copyFurnish: nextList }
    });
    if (!res.ok) {
      setError(res.data?.error || 'Failed to update copy furnish checklist');
      return;
    }
    setItem(res.data);
    setCopyFurnishList(Array.isArray(res.data?.copyFurnish) ? res.data.copyFurnish : []);
  }

  function onAddCopyFurnish(e) {
    e.preventDefault();
    const name = copyFurnishInput.trim();
    if (!name) return;
    const nextList = [
      ...copyFurnishList,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, done: false }
    ];
    setCopyFurnishList(nextList);
    persistCopyFurnish(nextList);
    setCopyFurnishInput('');
  }

  function onToggleCopyFurnish(id) {
    const nextList = copyFurnishList.map((entry) =>
      entry.id === id ? { ...entry, done: !entry.done } : entry
    );
    setCopyFurnishList(nextList);
    persistCopyFurnish(nextList);
  }

  useEffect(() => {
    if (!notice) return undefined;
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice('');
      noticeTimeoutRef.current = null;
    }, 5000);
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, [notice]);

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

    setNotice(`Transmittal ${transmittalId} updated.`);
    await loadItem(token);
  }

  async function onSaveReceipt(e) {
    e.preventDefault();
    if (!canReceive || !transmittalId) return;

    setError('');
    setNotice('');

    const res = await authedRequest(`/api/transmittals/${transmittalId}/status`, {
      method: 'PATCH',
      token,
      body: {
        status: 'Received',
        office: user?.office || '',
        agency: user?.agency || '',
        remarks: form.remarks,
        note: `Received by ${user?.username || 'viewer'}`
      }
    });

    if (!res.ok) {
      setError(res.data?.error || 'Failed to update transmittal status');
      return;
    }

    setNotice(`Transmittal ${transmittalId} marked as Received.`);
    setIsViewerEditing(false);
    await loadItem(token);
  }

  async function onUploadLetterFile(file) {
    if (!file || !transmittalId) return;
    if (!canEdit) {
      setError('Only admins or encoders can upload scanned transmittal letters.');
      return;
    }

    setError('');
    setNotice('');
    setIsUploadingLetter(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/transmittals/${transmittalId}/letter-upload`, {
        method: 'POST',
        headers: token && token !== COOKIE_TOKEN ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        credentials: 'include'
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(data?.error || 'Failed to upload scanned transmittal letter.');
        return;
      }

      setNotice('Scanned transmittal letter uploaded.');
      await loadItem(token);
    } finally {
      setIsUploadingLetter(false);
    }
  }

  function getUploadId(entry) {
    return `${entry.uploadedAt || ''}__${entry.fileName || ''}`;
  }

  function onStartEditUpload(entry) {
    if (!canEdit) return;
    setEditingUploadId(getUploadId(entry));
    setEditingUploadRemarks(String(entry.remarks || ''));
  }

  function onCancelEditUpload() {
    setEditingUploadId('');
    setEditingUploadRemarks('');
  }

  async function onSaveUploadRemarks(entry) {
    if (!canEdit || !transmittalId) return;
    setIsSavingUploadRemarks(true);
    setError('');
    try {
      const res = await authedRequest(`/api/transmittals/${transmittalId}/letter-upload`, {
        method: 'PATCH',
        token,
        body: {
          uploadedAt: entry.uploadedAt,
          fileName: entry.fileName,
          remarks: editingUploadRemarks
        }
      });
      if (!res.ok) {
        setError(res.data?.error || 'Failed to update upload remarks');
        return;
      }
      await loadItem(token);
      onCancelEditUpload();
    } finally {
      setIsSavingUploadRemarks(false);
    }
  }

  if (!ready) {
    return (
      <section className="panel doclist-template">
        <p className="muted">Loading...</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="panel doclist-template">
        <h3>Authentication required</h3>
        <p className="muted">Please log in first.</p>
        <Link href="/" className="nav-link">Go to Login</Link>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="panel doclist-template">
        <h3>Document not found</h3>
        <p className="muted">The selected document may have been removed.</p>
        <Link href="/dashboard/documents" className="nav-link">Back to Documents</Link>
      </section>
    );
  }

  return (
    <section className="panel doclist-template">
      <div className="doclist-top-action">
        {canEdit ? (
          <button type="button" className="doclist-export-btn" onClick={onOpenPostingForm}>Add Posting</button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="doclist-export-btn"
            onClick={() => {
              setNotice('');
              setError('');
              setIsEditing((v) => !v);
            }}
          >
            {isEditing ? 'Close Edit' : 'Edit Document'}
          </button>
        ) : null}
        {canReceive ? (
          <button
            type="button"
            className="doclist-export-btn"
            onClick={() => {
              setNotice('');
              setError('');
              setIsViewerEditing((v) => !v);
            }}
          >
            {isViewerEditing ? 'Close Edit' : 'Edit Details'}
          </button>
        ) : null}
      </div>

      {error ? <div style={{ color: '#b83a4b', marginBottom: '0.5rem' }}>{error}</div> : null}
      {notice ? <div style={{ color: '#1f7a4a', marginBottom: '0.5rem' }}>{notice}</div> : null}

      <section
        className="detail"
        style={{
          filter: isAddingPosting ? 'blur(3px)' : 'none',
          pointerEvents: isAddingPosting ? 'none' : 'auto'
        }}
      >
        <div className="detail-body">
          <div className="detail-main">
            <h3>{item.subject}</h3>
            <h4>Document Details</h4>
            <div className="table-wrap">
              <table>
                <tbody>
                  <tr>
                    <th>Transmittal ID</th>
                    <td>{item.id}</td>
                  </tr>
                  <tr>
                    <th>Document Type</th>
                    <td>{inferDocumentType(item)}</td>
                  </tr>
                  <tr>
                    <th>Reso/Ord No.</th>
                    <td>{item.controlNumber || '-'}</td>
                  </tr>
                  <tr>
                    <th>Origin Office</th>
                    <td>{item.originOffice || '-'}</td>
                  </tr>
                  <tr>
                    <th>Current Status</th>
                    <td><span className={`badge status-${String(item.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{item.status}</span></td>
                  </tr>
                  <tr>
                    <th>Current Holder</th>
                    <td>{item.currentHolder || '-'}</td>
                  </tr>
                  <tr>
                    <th>Remarks</th>
                    <td>{item.remarks || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <section style={{ marginTop: '3rem',  marginBottom: '5rem' }}>
              <h4>Copy Furnish Checklist</h4>
              <form onSubmit={onAddCopyFurnish} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  value={copyFurnishInput}
                  onChange={(e) => setCopyFurnishInput(e.target.value)}
                  placeholder="Add office/person to furnish"
                  style={{ flex: 1 }}
                  disabled={!canEdit}
                />
                <button type="submit" className="doclist-export-btn" disabled={!canEdit}>Add</button>
              </form>
              {copyFurnishList.length ? (
                <div style={{ display: 'flex', flexDirection: 'row', gap: '2.5rem', alignItems: 'flex-start' }}>
                  {copyFurnishList.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: '0.75rem',
                        width: '100%'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', textAlign: 'justify-text content' }}>
                        <input
                          type="checkbox"
                          checked={!!entry.done}
                          onChange={() => onToggleCopyFurnish(entry.id)}
                          disabled={!canEdit}
                        />
                        <span style={{ textDecoration: entry.done ? 'line-through' : 'none' }}>
                          {entry.name}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No copy furnish recipients yet.</p>
              )}
            </section>

            <div className="doclist-top-action detail-letter-action">
              <button
                type="button"
                className="doclist-export-btn"
                disabled={!canEdit || isUploadingLetter}
                onClick={() => letterUploadInputRef.current?.click()}
              >
                {isUploadingLetter ? 'Uploading...' : 'Upload Scan Transmittal Letter'}
              </button>
              <input
                ref={letterUploadInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) onUploadLetterFile(file);
                }}
              />
            </div>

            <section>
              <h4>Uploaded Scan Transmittal Letters</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Uploaded At</th>
                      <th>Uploaded By</th>
                      <th>File</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedLetterRows.length ? (
                      uploadedLetterRows.map((entry, i) => (
                        <tr key={`scan-letter-${entry.uploadedAt}-${i}`}>
                          <td>{entry.uploadedAt ? fmt(entry.uploadedAt) : '-'}</td>
                          <td>{entry.uploadedBy || '-'}</td>
                          <td>
                            {entry.url ? (
                              <a className="doclist-export-btn detail-inline-btn" href={entry.url} target="_blank" rel="noreferrer">
                                View File
                              </a>
                            ) : (
                              entry.fileName || '-'
                            )}
                          </td>
                          <td>
                            {editingUploadId === getUploadId(entry) ? (
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                  value={editingUploadRemarks}
                                  onChange={(e) => setEditingUploadRemarks(e.target.value)}
                                  placeholder="Remarks"
                                  style={{ flex: 1 }}
                                />
                                <button
                                  type="button"
                                  className="doclist-export-btn"
                                  onClick={() => onSaveUploadRemarks(entry)}
                                  disabled={isSavingUploadRemarks}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="doclist-export-btn"
                                  onClick={onCancelEditUpload}
                                  disabled={isSavingUploadRemarks}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{entry.remarks || '-'}</span>
                                <button
                                  type="button"
                                  className="action-icon-btn"
                                  title="Edit remarks"
                                  aria-label="Edit remarks"
                                  onClick={() => onStartEditUpload(entry)}
                                  disabled={!canEdit}
                                >
                                  <PencilSquareIcon className="action-icon-svg" aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="muted">No scanned transmittal letters uploaded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <h4>System Transmittal History</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th>Office</th>
                    <th>Agency</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {systemHistoryRows.length ? (
                    systemHistoryRows.map((h, i) => (
                      <tr key={`system-${h.timestamp}-${i}`}>
                        <td>{fmt(h.timestamp)}</td>
                        <td><span className={`badge status-${String(h.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{h.status || '-'}</span></td>
                        <td>{h.office || '-'}</td>
                        <td>{h.agency || '-'}</td>
                        <td>{h.note || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="muted">No system transmittal history yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h4>Letter Transmittal History</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th>Office</th>
                    <th>Agency</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {letterHistoryRows.length ? (
                    letterHistoryRows.map((h, i) => (
                      <tr key={`history-letter-${h.timestamp}-${i}`}>
                        <td>
                          <button
                            type="button"
                            className="subject-link"
                            onClick={() => onOpenPrintHistory(h.timestamp)}
                          >
                            {fmt(h.timestamp)}
                          </button>
                        </td>
                        <td><span className={`badge status-${String(h.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{h.status || '-'}</span></td>
                        <td>{h.office || '-'}</td>
                        <td>{h.agency || '-'}</td>
                        <td>{h.note || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="muted">No letter transmittal history yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {canEdit && isEditing ? (
            <aside className="detail-update">
              <h4>Edit Details</h4>
              <form className="update-form" onSubmit={onSave}>
                <textarea
                  value={form.subject}
                  onChange={(e) => setForm((v) => ({ ...v, subject: e.target.value }))}
                  placeholder="Subject"
                  required
                  disabled={!canEdit}
                />
                <select value={form.documentType} onChange={(e) => setForm((v) => ({ ...v, documentType: e.target.value }))} disabled={!canEdit}>
                  <option>Resolution</option>
                  <option>Ordinance</option>
                </select>
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
                <button type="submit" className="save-user-btn update-submit-btn" disabled={!canEdit}>Save Details</button>
              </form>
            </aside>
          ) : null}
          {canReceive && isViewerEditing ? (
            <aside className="detail-update">
              <h4>Edit Details</h4>
              <form className="update-form" onSubmit={onSaveReceipt}>
                <select value="Received" disabled>
                  <option>Received</option>
                </select>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm((v) => ({ ...v, remarks: e.target.value }))}
                  placeholder="Remarks"
                />
                <button type="submit" className="save-user-btn update-submit-btn">Save Details</button>
              </form>
            </aside>
          ) : null}
        </div>
      </section>

      {isAddingPosting ? (
        <div className="history-modal-overlay" onClick={onCancelPostingForm}>
          <section
            className="panel history-modal doclist-template"
            style={{ width: 'min(900px, calc(100vw - 2rem))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="doclist-top-action" style={{ justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0 }}>Add Posting</h4>
              <button type="button" className="doclist-export-btn" onClick={onCancelPostingForm}>Close</button>
            </div>
            <div style={{ border: '1px solid #eceff4', borderRadius: '12px', padding: '0.85rem 1rem', background: '#ffffff' }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#111827' }}>Selected Document</p>
              <p style={{ margin: '0.35rem 0 0', color: '#4b5563' }}>
                {inferDocumentType(item)} No. {String(item.controlNumber || '-').trim()}
              </p>
              <p style={{ margin: '0.2rem 0 0', color: '#4b5563' }}>{item.subject || '-'}</p>
            </div>
            <form className="update-form" onSubmit={onSavePosting} style={{ marginTop: '1rem' }}>
              <label>
                Date Approved
                <input
                  type="date"
                  value={postingForm.dateApproved}
                  onChange={(e) => setPostingForm((v) => ({ ...v, dateApproved: e.target.value }))}
                  required
                />
              </label>
              <label>
                Date Received by Office
                <input
                  type="date"
                  value={postingForm.dateReceived}
                  onChange={(e) => setPostingForm((v) => ({ ...v, dateReceived: e.target.value }))}
                  required
                />
              </label>
              <label>
                Date Posted
                <input
                  type="date"
                  value={postingForm.datePosted}
                  onChange={(e) => setPostingForm((v) => ({ ...v, datePosted: e.target.value }))}
                />
              </label>
              <input
                value={postingForm.location}
                onChange={(e) => setPostingForm((v) => ({ ...v, location: e.target.value }))}
                placeholder="Posting Location"
              />
              <input
                value={postingForm.postedBy}
                onChange={(e) => setPostingForm((v) => ({ ...v, postedBy: e.target.value }))}
                placeholder="Posted By"
              />
              <select value={postingForm.status} onChange={(e) => setPostingForm((v) => ({ ...v, status: e.target.value }))}>
                <option>Posted</option>
                <option>Pending</option>
              </select>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="doclist-export-btn" onClick={onCancelPostingForm}>Cancel</button>
                <button type="submit" className="doclist-export-btn">Save Posting</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {isPrintHistoryOpen ? (
        <div className="history-modal-overlay" onClick={() => setIsPrintHistoryOpen(false)}>
          <section
            className="panel history-modal doclist-template"
            style={{ width: 'min(900px, calc(100vw - 2rem))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="doclist-top-action" style={{ justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0 }}>Printed Transmittal Letters</h4>
              <button type="button" className="doclist-export-btn" onClick={() => setIsPrintHistoryOpen(false)}>Close</button>
            </div>
            <p className="muted" style={{ marginTop: 0.4, marginBottom: '0.75rem' }}>
              Timestamp: {printHistoryTime ? fmt(printHistoryTime) : '-'}
            </p>
            {printHistoryError ? <p style={{ color: '#b83a4b' }}>{printHistoryError}</p> : null}
            {isPrintHistoryLoading ? (
              <p className="muted">Loading...</p>
            ) : (
              <>
                {printHistoryRows.length ? (
                  <div className="auto-letter-paper" style={{ marginBottom: '1rem' }}>
                    <header className="auto-letter-head">
                      <Image src="/taytay.png" alt="Municipal Seal" width={96} height={96} className="auto-letter-logo" />
                      <div className="auto-letter-head-center">
                        <p>Republic of the Philippines</p>
                        <p className="strong">MUNICIPALITY OF TAYTAY</p>
                        <p>Province of Palawan</p>
                        <p className="office">OFFICE OF THE SECRETARY TO THE SANGGUNIANG BAYAN</p>
                        <p className="office">(RECORDS SECTION)</p>
                      </div>
                      <Image src="/sbtaytay.png" alt="Sangguniang Bayan Seal" width={106} height={106} className="auto-letter-logo" />
                    </header>
                    <p className="auto-letter-date">{printLetterMeta.displayDate || '-'}</p>
                    <div className="auto-letter-recipient">
                      <p className="strong auto-letter-recipient-name">{printLetterMeta.recipientName || '-'}</p>
                      <p>{printLetterMeta.recipientTitle || '-'}</p>
                      <p>{printLetterMeta.recipientOffice || '-'}</p>
                    </div>
                    <br />
                    <p className="auto-letter-salutation">{printLetterMeta.salutation || '-'}</p>
                    <p className="strong">GREETINGS!</p>
                    <p>
                      Respectfully forwarding herewith an e-copy of document/s, properly described in detail below, acted by the
                      local Sangguniang in its Regular Session conducted at the Session Hall, Legislative Building, Barangay
                      Poblacion. Taytay, Palawan.
                    </p>
                    <ol className="auto-letter-list">
                      {printHistoryRows.map(({ item }, index) => (
                        <li key={`print-history-${item.id}`}>
                          <span className="strong auto-letter-docno">
                            {inferDocumentType(item).toUpperCase()} NO. {item.controlNumber || '-'}
                          </span>; "
                          <span className="auto-letter-italic">{item.subject || 'TITLE OF DOCUMENT'}</span>".
                        </li>
                      ))}
                    </ol>
                    <p>For your information and/or appropriate action.</p>
                    <p>Kindly acknowledge receipt herewith.</p>
                    <p>Thank you very much.</p>
                    <div className="auto-letter-sign">
                      <p>Respectfully yours,</p>
                      <p className="strong">EMELY B. DEL ROSARIO</p>
                      <p>Records Officer II</p>
                    </div>
                  </div>
                ) : (
                  <p className="muted">No printed transmittal letters found.</p>
                )}
              </>
            )}
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
