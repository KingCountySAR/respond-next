import type { BootstrapResponse } from '@respond/shared/types/bootstrap';
import { useEffect, useState } from 'react';

import ClientProviders from '@respond/components/ClientProviders';
import LoginPanel from '@respond/components/LoginPanel';
import { apiFetch } from '@respond/lib/api';
import { useAppSelector } from '@respond/lib/client/store';

import { AppRoutes } from './routes';

// Replaces the old Next (main)/layout.tsx: show the login panel until authenticated.
function MainGate({ children }: { children: React.ReactNode }) {
  const userInfo = useAppSelector((state) => state.auth.userInfo);
  return userInfo ? <>{children}</> : <LoginPanel />;
}

export function App() {
  const [boot, setBoot] = useState<BootstrapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<BootstrapResponse>('/api/bootstrap')
      .then(setBoot)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div style={{ fontFamily: 'system-ui', padding: 24 }}>Failed to load: {error}</div>;
  if (!boot) return <div style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</div>;

  return (
    <ClientProviders googleClient={boot.googleClient} config={boot.config} user={boot.user} myOrg={boot.myOrg}>
      <MainGate>
        <AppRoutes />
      </MainGate>
    </ClientProviders>
  );
}
