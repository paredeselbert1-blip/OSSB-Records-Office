const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const TRANSMITTALS_FILE = path.join(DATA_DIR, 'transmittals.json');
const APPROVED_ECOPIES_FILE = path.join(DATA_DIR, 'approved-ecopies.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const APP_STATE_TABLE = 'app_state';
const APP_STATE_KEYS = {
  transmittals: 'transmittals',
  approvedEcopies: 'approved_ecopies',
  users: 'users',
  sessions: 'sessions'
};

let postgresReady = null;

function getSqlClient() {
  // Lazy-load to avoid requiring when not configured.
  // eslint-disable-next-line global-require
  const { sql } = require('@vercel/postgres');
  return sql;
}

async function ensurePostgres() {
  if (!process.env.POSTGRES_URL) return false;
  if (!postgresReady) {
    postgresReady = (async () => {
      const sql = getSqlClient();
      await sql`
        CREATE TABLE IF NOT EXISTS app_state (
          key text PRIMARY KEY,
          data jsonb NOT NULL,
          updated_at timestamptz DEFAULT now()
        )
      `;
      return true;
    })();
  }
  return postgresReady;
}

const ROLE_PERMISSIONS = {
  admin: { read: true, create: true, update: true },
  encoder: { read: true, create: true, update: true },
  viewer: { read: true, create: false, update: false, receive: true }
};

async function loadJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function saveJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function loadFromState(key, fallback, filePath) {
  if (await ensurePostgres()) {
    const sql = getSqlClient();
    const result = await sql`SELECT data FROM app_state WHERE key = ${key}`;
    if (result.rows.length) return result.rows[0].data || fallback;
    return fallback;
  }
  return loadJson(filePath, fallback);
}

async function saveToState(key, data, filePath) {
  if (await ensurePostgres()) {
    const sql = getSqlClient();
    await sql`
      INSERT INTO app_state (key, data, updated_at)
      VALUES (${key}, ${JSON.stringify(data)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `;
    return;
  }
  await saveJson(filePath, data);
}

async function loadTransmittals() {
  return loadFromState(APP_STATE_KEYS.transmittals, [], TRANSMITTALS_FILE);
}

async function saveTransmittals(data) {
  await saveToState(APP_STATE_KEYS.transmittals, data, TRANSMITTALS_FILE);
}

async function loadApprovedEcopies() {
  return loadFromState(APP_STATE_KEYS.approvedEcopies, [], APPROVED_ECOPIES_FILE);
}

async function saveApprovedEcopies(data) {
  await saveToState(APP_STATE_KEYS.approvedEcopies, data, APPROVED_ECOPIES_FILE);
}

async function loadUsers() {
  return loadFromState(APP_STATE_KEYS.users, [], USERS_FILE);
}

async function saveUsers(data) {
  await saveToState(APP_STATE_KEYS.users, data, USERS_FILE);
}

async function loadSessions() {
  return loadFromState(APP_STATE_KEYS.sessions, [], SESSIONS_FILE);
}

async function saveSessions(data) {
  await saveToState(APP_STATE_KEYS.sessions, data, SESSIONS_FILE);
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || 'dev-session-secret-change-me';
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const normalized = padded + '='.repeat(padLength);
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function signToken(payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body));
    return payload;
  } catch {
    return null;
  }
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

async function login(username, password, { remember } = {}) {
  const users = await loadUsers();
  const account = users.find((u) => u.username === username && u.password === password);
  if (!account) return null;

  const user = {
    username: account.username,
    role: account.role,
    office: account.office || '',
    agency: account.agency || ''
  };
  const now = Date.now();
  const ttlMs = remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12;
  const token = signToken({
    user,
    exp: now + ttlMs
  });
  return { token, user };
}

function logout(token) {
  if (!token) return;
  // Stateless tokens; nothing to revoke on the server.
}

function getUserByToken(token) {
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  if (typeof payload.exp === 'number' && Date.now() > payload.exp) return null;
  return payload.user || null;
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
  loadSessions,
  saveApprovedEcopies,
  saveUsers,
  saveSessions,
  login,
  logout,
  getUserByToken,
  ROLE_PERMISSIONS,
  saveTransmittals,
  summarize
};








