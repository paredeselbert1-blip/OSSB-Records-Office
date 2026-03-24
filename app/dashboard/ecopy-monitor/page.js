'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const COOKIE_TOKEN = '__cookie__';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toMonthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function toDateLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  const [y, m, d] = String(key || '').split('-').map((v) => Number(v));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function getMonthGrid(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i += 1) {
    const day = prevMonthDays - startDay + 1 + i;
    cells.push({ date: new Date(year, month - 1, day), isOutside: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), isOutside: false });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, nextDay), isOutside: true });
    nextDay += 1;
  }
  return cells;
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export default function EcopyMonitorPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [isTokenChecked, setIsTokenChecked] = useState(false);
  const [items, setItems] = useState([]);
  const [docItems, setDocItems] = useState([]);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addError, setAddError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [duplicateDates, setDuplicateDates] = useState([]);
  const [pendingDuplicate, setPendingDuplicate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchNotice, setSearchNotice] = useState('');
  const [highlightedDateKey, setHighlightedDateKey] = useState('');
  const [addForm, setAddForm] = useState({
    controlNumber: ''
  });

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const saved = sessionStorage.getItem('transmittal_token');
    setToken(saved || COOKIE_TOKEN);
    setIsTokenChecked(true);
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
    })();
  }, [token]);

  useEffect(() => {
    if (!isTokenChecked) return;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isTokenChecked, pathname, router, token]);

  async function loadItems() {
    if (!token) return;
    setIsRefreshing(true);
    const [approvedRes, docsRes] = await Promise.all([
      authedRequest('/api/approved-ecopies', { token }),
      authedRequest('/api/transmittals', { token })
    ]);

    if (!approvedRes.ok) {
      setError(approvedRes.data?.error || 'Failed to load records');
      setIsRefreshing(false);
      return;
    }

    if (!docsRes.ok) {
      setError(docsRes.data?.error || 'Failed to load document list');
    } else {
      setDocItems(docsRes.data.items || []);
    }

    setError('');
    setItems(approvedRes.data.items || []);
    setIsRefreshing(false);
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const grid = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);
  const label = useMemo(() => toMonthLabel(currentMonth), [currentMonth]);

  const approvedByDate = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      const key = String(item.approvedDate || '').trim();
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [items]);

  const docByControlNumber = useMemo(() => {
    const map = {};
    docItems.forEach((doc) => {
      const key = normalize(doc?.controlNumber);
      if (!key) return;
      const existing = map[key];
      if (!existing) {
        map[key] = doc;
        return;
      }
      const existingTime = Date.parse(existing.updatedAt || existing.createdAt || '');
      const nextTime = Date.parse(doc.updatedAt || doc.createdAt || '');
      if (Number.isFinite(nextTime) && (!Number.isFinite(existingTime) || nextTime > existingTime)) {
        map[key] = doc;
      }
    });
    return map;
  }, [docItems]);

  const calendarCounts = useMemo(() => {
    const counts = {};
    Object.entries(approvedByDate).forEach(([dateKey, list]) => {
      const approved = list.length;
      const done = list.reduce((acc, item) => {
        const match = docByControlNumber[normalize(item.controlNumber)];
        return acc + (match ? 1 : 0);
      }, 0);
      const notYet = Math.max(approved - done, 0);
      counts[dateKey] = { approved, done, notYet };
    });
    return counts;
  }, [approvedByDate, docByControlNumber]);

  const selectedDate = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey]);
  const selectedApproved = selectedDateKey ? (approvedByDate[selectedDateKey] || []) : [];

  function shiftMonth(delta) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function handleDateClick(cell) {
    const key = toDateKey(cell.date);
    setSelectedDateKey(key);
    if (cell.isOutside) {
      setCurrentMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
    }
  }

  function closePopup() {
    setSelectedDateKey('');
    setIsAddOpen(false);
    setAddError('');
    setDuplicateWarning('');
    setDuplicateDates([]);
    setPendingDuplicate(null);
  }

  function runSearch(raw) {
    const q = normalize(raw);
    if (!q) {
      setSearchNotice('');
      setHighlightedDateKey('');
      return;
    }
    const match = items.find((item) => normalize(item.controlNumber).includes(q));
    if (!match) {
      setSearchNotice('Walang match na Reso/Ordinance No.');
      setHighlightedDateKey('');
      return;
    }
    const key = String(match.approvedDate || '').trim();
    if (!key) {
      setSearchNotice('Walang petsa ang naitang na record.');
      setHighlightedDateKey('');
      return;
    }
    const matchDate = parseDateKey(key);
    if (matchDate) {
      setCurrentMonth(new Date(matchDate.getFullYear(), matchDate.getMonth(), 1));
    }
    setHighlightedDateKey(key);
    setSearchNotice('');
  }

  function onSearch(e) {
    e.preventDefault();
    runSearch(searchTerm);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      runSearch(searchTerm);
    }, 200);
    return () => clearTimeout(t);
  }, [searchTerm, items]);

  async function submitApproved(controlNumber) {
    const res = await authedRequest('/api/approved-ecopies', {
      method: 'POST',
      token,
      body: {
        approvedDate: selectedDateKey,
        controlNumber
      }
    });

    if (!res.ok) {
      setAddError(res.data?.error || 'Failed to add approved item');
      return;
    }

    setAddForm({ controlNumber: '' });
    setIsAddOpen(false);
    setDuplicateWarning('');
    setDuplicateDates([]);
    setPendingDuplicate(null);
    await loadItems();
  }

  function onUseExistingDate() {
    if (!pendingDuplicate) return;
    const [first] = pendingDuplicate.dates || [];
    if (!first) return;
    const targetDate = parseDateKey(first);
    if (targetDate) {
      setCurrentMonth(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
    }
    setSelectedDateKey(first);
    setIsAddOpen(false);
    setDuplicateWarning('');
    setDuplicateDates([]);
    setPendingDuplicate(null);
  }

  async function onUseCurrentDate() {
    if (!pendingDuplicate) return;
    await submitApproved(pendingDuplicate.controlNumber);
  }

  async function onAddApproved(e) {
    e.preventDefault();
    if (!selectedDateKey) return;
    setAddError('');
    setDuplicateWarning('');
    setDuplicateDates([]);
    setPendingDuplicate(null);

    const normalized = normalize(addForm.controlNumber);
    const duplicates = items.filter(
      (item) =>
        normalize(item.controlNumber) === normalized &&
        String(item.approvedDate || '').trim() &&
        String(item.approvedDate).trim() !== selectedDateKey
    );
    if (duplicates.length) {
      const dates = Array.from(
        new Set(duplicates.map((item) => String(item.approvedDate || '').trim()).filter(Boolean))
      );
      setDuplicateDates(dates);
      setDuplicateWarning(`There is a similar Resolution/Ordinance No. on the date: ${dates.join(', ')}`);
      setPendingDuplicate({ controlNumber: addForm.controlNumber, dates });
      return;
    }

    await submitApproved(addForm.controlNumber);
  }

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
    <section className="panel ecopy-calendar-panel">
      <form className="ecopy-calendar-search-bar" onSubmit={onSearch}>
        <label className="ecopy-calendar-search">
          <span>Search Reso/Ord No.</span>
          <div className="ecopy-calendar-search-row">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
            />
            <button type="submit">Search</button>
          </div>
        </label>
        {searchNotice ? <span className="ecopy-calendar-search-note">{searchNotice}</span> : null}
      </form>
      <div className="ecopy-calendar-head">
        <button type="button" className="ecopy-calendar-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <ChevronLeftIcon className="ecopy-calendar-nav-icon" aria-hidden="true" />
        </button>
        <div className="ecopy-calendar-title">
          <span className="ecopy-calendar-label">{label}</span>
          <span className="ecopy-calendar-sub">E-copy Monitoring Calendar</span>
        </div>
        <button type="button" className="ecopy-calendar-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronRightIcon className="ecopy-calendar-nav-icon" aria-hidden="true" />
        </button>
      </div>

      <div className="ecopy-calendar-grid">
        {WEEKDAYS.map((day) => (
          <div key={day} className="ecopy-calendar-weekday">{day}</div>
        ))}
        {grid.map((cell, idx) => {
          const key = toDateKey(cell.date);
          const counts = calendarCounts[key] || { approved: 0, done: 0, notYet: 0 };
          const isSelected = key === selectedDateKey;
          const dayOfWeek = cell.date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const sessionLabel = counts.approved > 0
            ? (dayOfWeek === 1 ? 'Regular Session' : 'Special Session')
            : '';
          const isDuplicate = duplicateDates.includes(key);
          const isHighlighted = key === highlightedDateKey;
          return (
            <div
              key={`cell-${idx}`}
              className={`ecopy-calendar-cell${cell.isOutside ? ' is-outside' : ''}`}
            >
              <button
                type="button"
                className={`ecopy-calendar-cell-btn${isSelected ? ' is-selected' : ''}${isWeekend ? ' is-disabled' : ''}${isDuplicate ? ' is-duplicate' : ''}${isHighlighted ? ' is-highlighted' : ''}`}
                onClick={() => handleDateClick(cell)}
                aria-label={`View approved items on ${toDateLabel(cell.date)}`}
                disabled={isWeekend}
              >
                {sessionLabel ? (
                  <span className="ecopy-calendar-session">{sessionLabel}</span>
                ) : null}
                <span className="ecopy-calendar-day">{cell.date.getDate()}</span>
                {counts.approved > 0 ? (
                  <div className="ecopy-calendar-metrics">
                    <span className="ecopy-calendar-count">{counts.approved} approved</span>
                    <span className="ecopy-calendar-done">{counts.done} done</span>
                    <span className="ecopy-calendar-notyet">{counts.notYet} not yet</span>
                  </div>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      {selectedDateKey ? (
        <div className="ecopy-calendar-popup-overlay" onClick={closePopup}>
          <section
            className="ecopy-calendar-popup"
            onClick={(e) => e.stopPropagation()}
            aria-label="Approved resolutions and ordinances"
          >
            <div className="ecopy-calendar-popup-head">
              <div>
                <strong>{selectedDate ? toDateLabel(selectedDate) : 'Selected date'}</strong>
                <span>Approved resolutions/ordinances</span>
              </div>
              <div className="ecopy-calendar-popup-actions">
                <button
                  type="button"
                  className="ecopy-calendar-refresh"
                  onClick={() => {
                    setIsAddOpen((v) => !v);
                    setAddError('');
                  }}
                  disabled={!selectedDateKey}
                >
                  {isAddOpen ? 'Close' : 'Add'}
                </button>
                <button type="button" className="ecopy-calendar-close" onClick={closePopup} aria-label="Close">
                  ×
                </button>
              </div>
            </div>
            {isAddOpen ? (
              <form className="ecopy-calendar-add-form" onSubmit={onAddApproved}>
                <label>
                  Reso/Ordinance No.
                  <input
                    value={addForm.controlNumber}
                    onChange={(e) => setAddForm((v) => ({ ...v, controlNumber: e.target.value }))}
                    placeholder="e.g., Reso 12-2026"
                    required
                  />
                </label>
                {duplicateWarning ? (
                  <div className="ecopy-calendar-warning">
                    <p>{duplicateWarning}</p>
                    <div className="ecopy-calendar-warning-actions">
                      <button type="button" onClick={onUseExistingDate}>
                        Use existing date
                      </button>
                      <button type="button" onClick={onUseCurrentDate}>
                        Use this date
                      </button>
                    </div>
                  </div>
                ) : null}
                {addError ? <p style={{ color: '#b83a4b', margin: 0 }}>{addError}</p> : null}
                <button type="submit" className="ecopy-calendar-add-btn">
                  Save
                </button>
              </form>
            ) : null}
            {error ? <p style={{ color: '#b83a4b' }}>{error}</p> : null}
            <div className="ecopy-calendar-table-wrap">
              <table className="ecopy-calendar-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Reso/Ordinance No.</th>
                    <th>E-copy</th>
                    <th>E-copy Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedApproved.length ? (
                    selectedApproved.map((item, index) => {
                      const match = docByControlNumber[normalize(item.controlNumber)];
                      return (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.controlNumber || item.id}</td>
                          <td className="ecopy-calendar-ecopy">
                            {match ? (
                              <Link href={`/dashboard/documents/${match.id}`}>View</Link>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>
                            <span className={`badge ${match ? 'ecopy-status-done' : 'ecopy-status-notyet'}`}>
                              {match ? 'Done' : 'Not Yet'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="muted">There are no approved Resolutions/Ordinances on this day.</td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
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
