import { Suspense } from 'react';
import PostingClient from './posting-client';

export default function PostingPage() {
  return (
    <Suspense
      fallback={(
        <main style={{ maxWidth: 500, margin: '2rem auto' }}>
          <section className="panel">
            <p className="muted">Loading posting log...</p>
          </section>
        </main>
      )}
    >
      <PostingClient />
    </Suspense>
  );
}
