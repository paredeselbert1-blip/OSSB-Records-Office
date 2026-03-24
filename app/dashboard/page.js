import { Suspense } from 'react';
import DashboardClient from './dashboard-client';

export default function DashboardPage() {
  return (
    <Suspense
      fallback={(
        <main style={{ maxWidth: 500, margin: '2rem auto' }}>
          <section className="panel">
            <p className="muted">Loading dashboard...</p>
          </section>
        </main>
      )}
    >
      <DashboardClient />
    </Suspense>
  );
}
