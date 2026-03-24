import { Suspense } from 'react';
import DocumentsClient from './documents-client';

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={(
        <main style={{ maxWidth: 500, margin: '2rem auto' }}>
          <section className="panel">
            <p className="muted">Loading documents...</p>
          </section>
        </main>
      )}
    >
      <DocumentsClient />
    </Suspense>
  );
}
