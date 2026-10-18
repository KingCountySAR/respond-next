/**
 * The shell: loads the site config, themes the app, gates it behind sign-in, starts the session's
 * SyncClient and routes to the sections. Sections only see the shell through the hooks exported here
 * and from `./sync`, `./auth` and `./ActivityLayout`.
 */
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BootstrapResponse, SiteConfig } from '@sync/domain';
import type { UnitRef } from '@sync/model';
import { ApiProvider, fetchApi, type Api } from './api';
import { AuthProvider, useAuth } from './auth';
import { DialogProvider } from './dialogs';
import { LoginPanel } from './LoginPanel';
import { PreferencesProvider } from './preferences';
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
  /** For tests: the HTTP API (member search). */
  api?: Api;
}

export function App({ bootstrap = fetchBootstrap, sync, api = fetchApi }: AppProps) {
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
      <ApiProvider api={api}>
        <Themed theme={boot.config.theme}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <PreferencesProvider>
              <AuthProvider>
                <MainGate sync={sync}>
                  <DialogProvider>
                    <AppRoutes />
                  </DialogProvider>
                </MainGate>
              </AuthProvider>
            </PreferencesProvider>
          </LocalizationProvider>
        </Themed>
      </ApiProvider>
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

/** The unit the signed-in person responds under: the site's organization, as in the legacy app. */
export function useHomeUnit(): UnitRef {
  const { id, title, shortTitle } = useSite().organization;
  return { id, title, rosterName: shortTitle };
}
