import { Suspense } from 'react';
import LoginClient from './login-client';

export default function LoginPage() {
  return (
    <Suspense
      fallback={(
        <main style={{ maxWidth: 500, margin: '2rem auto' }}>
          <section className="panel">
            <p className="muted">Loading login...</p>
          </section>
        </main>
      )}
    >
      <LoginClient />
    </Suspense>
  );
}
