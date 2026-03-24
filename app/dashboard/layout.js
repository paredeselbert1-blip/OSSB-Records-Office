'use client';

import { useEffect, useState } from 'react';
import SidebarNav from '../components/sidebar-nav';

const COOKIE_TOKEN = '__cookie__';

export default function DashboardLayout({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      const token = sessionStorage.getItem('transmittal_token') || '';
      const me = await authedRequest('/api/me', { token: token || COOKIE_TOKEN });
      if (!me.ok) {
        sessionStorage.removeItem('transmittal_token');
        setUser(null);
        setReady(true);
        return;
      }
      if (!token) {
        sessionStorage.setItem('transmittal_token', COOKIE_TOKEN);
      }
      setUser(me.data.user || null);
      setReady(true);
    })();
  }, []);

  async function onLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Continue local logout even if server call fails.
    } finally {
      sessionStorage.removeItem('transmittal_token');
      window.location.href = '/';
    }
  }

  if (!ready || !user) return children;

  return (
    <div className={`dashboard-shell${isSidebarExpanded ? ' expanded' : ''}`}>
      <SidebarNav
        role={user.role}
        isAdmin={user.role === 'admin'}
        onLogout={onLogout}
        user={user}
        isExpanded={isSidebarExpanded}
        onToggleExpand={() => setIsSidebarExpanded((v) => !v)}
      />
      <section className="dashboard-content">{children}</section>
    </div>
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
