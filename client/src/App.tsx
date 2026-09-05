import { useEffect, useState } from 'react';

import ClientProviders from '@respond/components/ClientProviders';
import LoginPanel from '@respond/components/LoginPanel';
import { apiFetch } from '@respond/lib/api';
import { useAppSelector } from '@respond/lib/client/store';
import type { BootstrapResponse } from '@respond/shared/types/bootstrap';

import { DialogProvider } from './components/DialogProvider';
import { AppRoutes } from './routes';

function setMetaThemeColor(color: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

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

  useEffect(() => {
    if (!boot) return;
    document.title = `${boot.config.organization.shortTitle ?? boot.config.organization.title} Respond`;
    setMetaThemeColor(boot.config.theme.primary);
  }, [boot]);

  if (error) return <div style={{ fontFamily: 'system-ui', padding: 24 }}>Failed to load: {error}</div>;
  if (!boot) return <div style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</div>;

  return (
    <ClientProviders googleClient={boot.googleClient} config={boot.config} user={boot.user} myOrg={boot.myOrg}>
      <MainGate>
        <DialogProvider>
          <AppRoutes />
        </DialogProvider>
      </MainGate>
    </ClientProviders>
  );
}
