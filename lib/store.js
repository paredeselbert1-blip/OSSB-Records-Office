const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const TRANSMITTALS_FILE = path.join(DATA_DIR, 'transmittals.json');
const APPROVED_ECOPIES_FILE = path.join(DATA_DIR, 'approved-ecopies.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

const ROLE_PERMISSIONS = {
  admin: { read: true, create: true, update: true },
  encoder: { read: true, create: true, update: true },
  viewer: { read: true, create: false, update: false, receive: true }
};

function loadJson(filePath, fallback) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadTransmittals() {
  return loadJson(TRANSMITTALS_FILE, []);
}

function saveTransmittals(data) {
  saveJson(TRANSMITTALS_FILE, data);
}

function loadApprovedEcopies() {
  return loadJson(APPROVED_ECOPIES_FILE, []);
}

function saveApprovedEcopies(data) {
  saveJson(APPROVED_ECOPIES_FILE, data);
}

function loadUsers() {
  return loadJson(USERS_FILE, []);
}

function saveUsers(data) {
  saveJson(USERS_FILE, data);
}

function loadSessions() {
  return loadJson(SESSIONS_FILE, []);
}

function saveSessions(data) {
  saveJson(SESSIONS_FILE, data);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function generateId(transmittals) {
  const year = new Date().getFullYear();
  const prefix = `TRM-${year}-`;
  const next =
    transmittals
      .map((t) => t.id)
      .filter((id) => id && id.startsWith(prefix))
      .map((id) => Number(id.slice(prefix.length)))
      .filter((n) => Number.isFinite(n))
      .reduce((max, curr) => Math.max(max, curr), 0) + 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
}

function generateApprovedId(items) {
  const year = new Date().getFullYear();
  const prefix = `ECP-${year}-`;
  const next =
    items
      .map((t) => t.id)
      .filter((id) => id && id.startsWith(prefix))
      .map((id) => Number(id.slice(prefix.length)))
      .filter((n) => Number.isFinite(n))
      .reduce((max, curr) => Math.max(max, curr), 0) + 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
}

function filterTransmittals(items, query) {
  const status = normalizeText(query.status);
  const office = normalizeText(query.office);
  const agency = normalizeText(query.agency);
  const q = normalizeText(query.q);
  const from = query.from;
  const to = query.to;

  return items.filter((item) => {
    if (status && normalizeText(item.status) !== status) return false;

    if (office) {
      const inOffice =
        normalizeText(item.originOffice).includes(office) ||
        normalizeText(item.currentHolder).includes(office) ||
        (item.history || []).some((h) => normalizeText(h.office).includes(office));
      if (!inOffice) return false;
    }

    if (agency) {
      const inAgency =
        normalizeText(item.targetAgency).includes(agency) ||
        (item.history || []).some((h) => normalizeText(h.agency).includes(agency));
      if (!inAgency) return false;
    }

    if (q) {
      const haystack = [
        item.id,
        item.subject,
        item.controlNumber,
        item.originOffice,
        item.targetAgency,
        item.currentHolder,
        item.remarks
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (from) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) return false;
      if (new Date(item.createdAt) < fromDate) return false;
    }

    if (to) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) return false;
      toDate.setHours(23, 59, 59, 999);
      if (new Date(item.createdAt) > toDate) return false;
    }

    return true;
  });
}

function summarize(items) {
  return {
    total: items.length,
    created: items.filter((t) => t.status === 'Created').length,
    dispatched: items.filter((t) => t.status === 'Dispatched').length,
    received: items.filter((t) => t.status === 'Received').length,
    inReview: items.filter((t) => t.status === 'In Review').length,
    completed: items.filter((t) => t.status === 'Completed').length
  };
}

function login(username, password) {
  const users = loadUsers();
  const account = users.find((u) => u.username === username && u.password === password);
  if (!account) return null;

  const token = crypto.randomBytes(24).toString('hex');
  const user = {
    username: account.username,
    role: account.role,
    office: account.office || '',
    agency: account.agency || ''
  };
  const sessions = loadSessions();
  sessions.push({
    token,
    user,
    createdAt: new Date().toISOString()
  });
  saveSessions(sessions);
  return { token, user };
}

function logout(token) {
  if (!token) return;
  const sessions = loadSessions().filter((s) => s.token !== token);
  saveSessions(sessions);
}

function getUserByToken(token) {
  if (!token) return null;
  const sessions = loadSessions();
  const session = sessions.find((s) => s.token === token);
  return session?.user || null;
}

function hasPermission(user, action) {
  const permissions = ROLE_PERMISSIONS[user.role] || {};
  return Boolean(permissions[action]);
}

module.exports = {
  filterTransmittals,
  generateId,
  generateApprovedId,
  hasPermission,
  loadTransmittals,
  loadApprovedEcopies,
  loadUsers,
  saveApprovedEcopies,
  saveUsers,
  login,
  logout,
  getUserByToken,
  ROLE_PERMISSIONS,
  saveTransmittals,
  summarize
};
