'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';

const COOKIE_TOKEN = '__cookie__';

export default function AutoLetterPage() {
  const [template, setTemplate] = useState('mayor');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    ccLeft: 'HON. ROSALIE A. SALVAME\nMSWDO',
    ccRight: 'RES. NO. 112-2026\nRES. NO. 117-2026',
    otherRecipientName: '',
    otherRecipientTitle: '',
    otherRecipientOffice: ''
  });

  const [rows, setRows] = useState([]);
  const [selectedMap, setSelectedMap] = useState({});
  const [loadError, setLoadError] = useState('');
  const [officeOptions, setOfficeOptions] = useState([]);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);

  const displayDate = form.date
    ? new Date(`${form.date}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'March 2, 2026';
  const ccRightLines = form.ccRight
    ? form.ccRight.split('\n').map((line) => line.trim()).filter(Boolean)
    : [];
  const isMayorTemplate = template === 'mayor';
  const hasCcLeft = Boolean(form.ccLeft && form.ccLeft.trim());
  const hasCcRight = ccRightLines.length > 0;
  const hasCc = isMayorTemplate && (hasCcLeft || hasCcRight);
  const recipientOfficeValue = isMayorTemplate
    ? "Mayor's Office"
    : (form.otherRecipientOffice || 'Other Office');
  const recipientAgencyValue = isMayorTemplate
    ? "Mayor's Office"
    : (form.otherRecipientOffice || 'Other Office');
  const recipientName = isMayorTemplate
    ? 'HON. NORBERT LIM'
    : (form.otherRecipientName || 'HON. ____________________');
  const recipientTitle = isMayorTemplate
    ? 'Municipal Mayor'
    : (form.otherRecipientOffice || 'This Office');
  const recipientOffice = isMayorTemplate
    ? 'This Municipality'
    : (form.otherRecipientTitle || 'Office/Title');
  const salutation = isMayorTemplate
    ? 'Dear Mayor Lim;'
    : 'Dear Sir/Madam;';

  const selectedItems = useMemo(
    () => rows.filter((row) => selectedMap[row.id]),
    [rows, selectedMap]
  );
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.docType} ${row.controlNumber} ${row.subject}`.toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  useEffect(() => {
    const saved = sessionStorage.getItem('transmittal_token') || '';
    setToken(saved || COOKIE_TOKEN);
  }, []);

  useEffect(() => {
    if (!actionSuccess) return undefined;
    const timer = setTimeout(() => setActionSuccess(''), 5000);
    return () => clearTimeout(timer);
  }, [actionSuccess]);

  useEffect(() => {
    if (!token) {
      setLoadError('Login required to load transmittals.');
      return;
    }

    (async () => {
      setLoadError('');
      const me = await authedRequest('/api/me', { token });
      if (me.ok) {
        if (token === COOKIE_TOKEN) {
          sessionStorage.setItem('transmittal_token', COOKIE_TOKEN);
        }
        setUser(me.data.user);
      }

      const officesRes = await authedRequest('/api/offices', { token });
      if (officesRes.ok) {
        setOfficeOptions(officesRes.data?.offices || []);
      }

      const res = await authedRequest('/api/transmittals', { token });
      if (!res.ok) {
        setLoadError(res.data?.error || 'Failed to load transmittals');
        return;
      }

      const normalized = (res.data?.items || []).map((item) => {
        const explicitType = String(item.documentType || '').trim();
        const fallbackType = inferDocumentType(item);
        const docType = explicitType === 'Resolution' || explicitType === 'Ordinance'
          ? explicitType.toUpperCase()
          : fallbackType.toUpperCase();
        return {
          id: item.id,
          docType,
          controlNumber: String(item.controlNumber || '').trim(),
          subject: String(item.subject || '').trim()
        };
      }).filter((item) => item.controlNumber || item.subject);

      setRows(normalized);

      // Preselect first two rows for faster draft generation.
      const defaults = {};
      normalized.slice(0, 2).forEach((row) => {
        defaults[row.id] = true;
      });
      setSelectedMap(defaults);
    })();
  }, [token]);

  function onToggleRow(id) {
    setSelectedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function onBulkDispatch() {
    setActionError('');
    setActionSuccess('');
    if (!token) {
      setActionError('Login required to dispatch selected documents.');
      return { ok: false };
    }
    if (!user) {
      setActionError('Unable to load your account details.');
      return { ok: false };
    }
    if (!selectedItems.length) {
      setActionError('Select at least one document first.');
      return { ok: false };
    }
    setIsBulkBusy(true);
    const res = await authedRequest('/api/transmittals/bulk-status', {
      method: 'POST',
      token,
      body: {
        ids: selectedItems.map((item) => item.id),
        status: 'Dispatched',
        office: user.office,
        agency: user.agency,
        recipientOffice: recipientOfficeValue,
        recipientAgency: recipientAgencyValue,
        note: `Auto letter generated for ${recipientName} (${recipientOfficeValue}) on ${displayDate}.`
      }
    });
    setIsBulkBusy(false);
    if (!res.ok) {
      setActionError(res.data?.error || 'Failed to dispatch selected documents.');
      return { ok: false };
    }
    setActionSuccess(`Dispatched ${res.data?.updatedCount || selectedItems.length} document(s).`);
    return { ok: true };
  }

  async function onPrintAndDispatch() {
    if (isBulkBusy) return;
    const result = await onBulkDispatch();
    if (result?.ok) {
      window.print();
    }
  }

  return (
    <div className="dashboard-insights auto-letter-layout">
      {actionSuccess ? (
        <div className="auto-letter-success">{actionSuccess}</div>
      ) : null}
      <section className="panel doclist-template create-doclist-form auto-letter-controls no-print">
        <h3>Generate Letter</h3>
        <div className="auto-letter-template-switch">
          <p className="muted"><strong>Recipient Office</strong></p>
          <div className="auto-letter-template-buttons">
            <button
              type="button"
              className={`save-user-btn auto-letter-template-btn ${isMayorTemplate ? 'auto-letter-template-btn-active' : ''}`}
              onClick={() => setTemplate('mayor')}
            >
              Mayor's Office
            </button>
            <button
              type="button"
              className={`save-user-btn auto-letter-template-btn ${!isMayorTemplate ? 'auto-letter-template-btn-active' : ''}`}
              onClick={() => setTemplate('other')}
            >
              Other Office
            </button>
          </div>
        </div>
        
        <form className="create-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((v) => ({ ...v, date: e.target.value }))}
            />
          </label>
          {!isMayorTemplate ? (
            <div className="auto-letter-other-office-fields">
              <label>
                Recipient Name
                <input
                  type="text"
                  placeholder="HON. ____________________"
                  value={form.otherRecipientName}
                  onChange={(e) => setForm((v) => ({ ...v, otherRecipientName: e.target.value }))}
                />
              </label>
              <label>
                Recipient Title
                <input
                  type="text"
                  placeholder="Office/Title"
                  value={form.otherRecipientTitle}
                  onChange={(e) => setForm((v) => ({ ...v, otherRecipientTitle: e.target.value }))}
                />
              </label>
              <label>
                Recipient Office
                <select
                  value={form.otherRecipientOffice}
                  onChange={(e) => setForm((v) => ({ ...v, otherRecipientOffice: e.target.value }))}
                >
                  <option value="">Select office</option>
                  {officeOptions.map((office) => (
                    <option key={`office-${office}`} value={office}>{office}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <div className="auto-letter-item-form">
            <p className="muted"><strong>Document Title/Subject</strong></p>
            {loadError ? <p className="muted">{loadError}</p> : null}
            <div className="auto-letter-mini-search-row">
              <label className="search-box auto-letter-mini-search">
                <input
                  className="search-field"
                  placeholder="SEARCH..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </label>
            </div>
            <div className="auto-letter-mini-table-wrap">
              <table className="auto-letter-mini-table">                                                                                                        
                <thead>
                  <tr>
                    <th>Reso/Ordi No.</th>
                    <th className="auto-letter-check-col">Use</th>
                    <th>Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length ? filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.docType} NO. {row.controlNumber || '-'}</td>
                      <td className="auto-letter-check-col">
                        <input
                          className="auto-letter-mini-check"
                          type="checkbox"
                          checked={!!selectedMap[row.id]}
                          onChange={() => onToggleRow(row.id)}
                          aria-label={`Include ${row.controlNumber || row.id}`}
                        />
                      </td>
                      <td>{row.subject || '-'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3}>No matching transmittals.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {isMayorTemplate ? (
            <>
              <textarea
                placeholder="Office"
                value={form.ccLeft}
                onChange={(e) => setForm((v) => ({ ...v, ccLeft: e.target.value }))}
              />
              <textarea
                placeholder="Reso/Ordi No."
                value={form.ccRight}
                onChange={(e) => setForm((v) => ({ ...v, ccRight: e.target.value }))}
              />
            </>
          ) : null}
          {actionError ? <p style={{ color: '#b83a4b' }}>{actionError}</p> : null}
          {actionSuccess ? <p style={{ color: '#1f7a3a' }}>{actionSuccess}</p> : null}
        </form>
      </section>

      <section className="panel doclist-template create-doclist-form auto-letter-preview-panel">
        <div className="doclist-top-action no-print">
          <div className="doclist-toolbar-left">
            <div className="doclist-export-btn" aria-live="polite">
              Selected documents ({selectedItems.length})
            </div>
          </div>
          <button type="button" className="doclist-export-btn auto-letter-print-btn" onClick={onPrintAndDispatch}>
            <PrinterIcon className="doclist-toolbar-icon" aria-hidden="true" />
            <span>Print</span>
          </button>
        </div>
       
        <div className="auto-letter-paper">
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

          <p className="auto-letter-date">{displayDate}</p>

          <div className="auto-letter-recipient">
            <p className="strong auto-letter-recipient-name">{recipientName}</p>
            <p>{recipientTitle}</p>
            <p>{recipientOffice}</p>
          </div>
          <br></br>
          <p className="auto-letter-salutation">{salutation}</p>
          <p className="strong">GREETINGS!</p>
          <p>
            Respectfully forwarding herewith an e-copy of document/s, properly described in detail below, acted by the
            local Sangguniang in its Regular Session conducted at the Session Hall, Legislative Building, Barangay
            Poblacion. Taytay, Palawan.
          </p>

          <ol className="auto-letter-list">
            {selectedItems.length ? selectedItems.map((item, index) => (
              <li key={`preview-${index}`}>
                <span className="strong auto-letter-docno">{item.docType} NO. {item.controlNumber || '-'}</span>; "
                <span className="auto-letter-italic">{item.subject || 'TITLE OF DOCUMENT'}</span>".
              </li>
            )) : (
              <li>
                <span className="auto-letter-italic">No selected document yet.</span>
              </li>
            )}
          </ol>

          <p>For your information and/or appropriate action.</p>
          <p>Kindly acknowledge receipt herewith.</p>
          <p>Thank you very much.</p>

          <div className="auto-letter-sign">
            <p>Respectfully yours,</p>
            <p className="strong">EMELY B. DEL ROSARIO</p>
            <p>Records Officer II</p>
          </div>

          {hasCc ? (
            <div className="auto-letter-cc">
              <p className="strong">CC:</p>
              <div>
                <p>{hasCcLeft ? form.ccLeft : ''}</p>
                {hasCcRight ? (
                  <div className="auto-letter-cc-right">
                    {ccRightLines.map((line, index) => (
                      <div className="auto-letter-cc-line" key={`cc-line-${index}`}>
                        <span className="auto-letter-cc-doc">{line}</span>
                        <span className="auto-letter-cc-underline" aria-hidden="true">
                          <span />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          
        </div>
        
      </section>
    </div>
  );
}

function inferDocumentType(item) {
  const subject = String(item?.subject || '').toLowerCase();
  const controlNumber = String(item?.controlNumber || '').toLowerCase();
  if (subject.includes('ordinance') || controlNumber.includes('ord')) return 'Ordinance';
  return 'Resolution';
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
