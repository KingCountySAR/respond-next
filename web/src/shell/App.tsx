/**
 * The shell: loads the site config, themes the app, gates it behind sign-in, starts the session's
 * SyncClient and routes to the sections. Sections only see the shell through the hooks exported here
 * and from `./sync`, `./auth` and `./ActivityLayout`.
 */
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BootstrapResponse, SiteConfig } from '@sync/domain';
import { AuthProvider, useAuth } from './auth';
import { LoginPanel } from './LoginPanel';
import { AppRoutes } from './routes';
import { SyncProvider, type SyncOptions } from './sync';
import { buildTheme } from './theme';

const SiteContext = createContext<SiteConfig | null>(null);

export function useSite(): SiteConfig {
  const site = useContext(SiteContext);
  if (!site) throw new Error('useSite must be used inside the App');
  return site;
}

function setMetaThemeColor(color: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

async function fetchBootstrap(): Promise<BootstrapResponse> {
  const res = await fetch('/api/bootstrap');
  if (!res.ok) throw new Error(`bootstrap: HTTP ${res.status}`);
  return (await res.json()) as BootstrapResponse;
}

export interface AppProps {
  /** For tests: where the site config comes from, and how the SyncClient connects. */
  bootstrap?: () => Promise<BootstrapResponse>;
  sync?: SyncOptions;
}

export function App({ bootstrap = fetchBootstrap, sync }: AppProps) {
  const [boot, setBoot] = useState<BootstrapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrap()
      .then(setBoot)
      .catch((e) => setError(String(e)));
  }, [bootstrap]);

  useEffect(() => {
    if (!boot) return;
    document.title = `${boot.config.organization.shortTitle ?? boot.config.organization.title} Respond`;
    setMetaThemeColor(boot.config.theme.primary);
  }, [boot]);

  if (error) return <div style={{ fontFamily: 'system-ui', padding: 24 }}>Failed to load: {error}</div>;
  if (!boot) return <div style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</div>;

  return (
    <SiteContext.Provider value={boot.config}>
      <Themed theme={boot.config.theme}>
        <AuthProvider>
          <MainGate sync={sync}>
            <AppRoutes />
          </MainGate>
        </AuthProvider>
      </Themed>
    </SiteContext.Provider>
  );
}

function Themed({ theme, children }: { theme: SiteConfig['theme']; children: ReactNode }) {
  const dark = useMediaQuery('(prefers-color-scheme: dark)');
  const built = useMemo(() => buildTheme(theme, dark), [theme, dark]);
  return <ThemeProvider theme={built}>{children}</ThemeProvider>;
}

/** The login panel until someone signs in; then their SyncClient and the app. */
function MainGate({ sync, children }: { sync?: SyncOptions; children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return <LoginPanel />;
  return (
    // Keyed by user, so signing in as someone else starts fresh.
    <SyncProvider key={session.userId} session={session} options={sync}>
      {children}
    </SyncProvider>
  );
}
