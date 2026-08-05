'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Provider } from 'react-redux';

import { createTheme, ThemeOptions, ThemeProvider, useMediaQuery } from '@respond/components/Material';
import { AppStore, buildClientStore } from '@respond/lib/client/store';
import { AuthActions } from '@respond/lib/client/store/auth';
import { ConfigActions } from '@respond/lib/client/store/config';
import { OrgActions } from '@respond/lib/client/store/organization';
import { ClientSync } from '@respond/lib/client/sync';
import type { SiteConfig } from '@respond/shared/types/bootstrap';
import { MyOrganization } from '@respond/shared/types/organization';
import { UserInfo } from '@respond/shared/types/userInfo';

import PreferencesProvider from './PreferencesProvider';

export type { SiteConfig };

export default function ClientProviders({ googleClient, config, user, myOrg, children }: { googleClient: string; config: SiteConfig; user?: UserInfo; myOrg?: MyOrganization; children: ReactNode }) {
  const [store] = useState<AppStore>(buildClientStore([]));
  const [sync] = useState<ClientSync>(new ClientSync(store));
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    console.log('ClientProviders mounting ...');
    sync.start();
  }, [sync]);

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const hydratedTheme = useMemo(() => {
    console.log('rendering theme');
    const theme: ThemeOptions = {
      palette: {
        mode: prefersDarkMode ? 'dark' : 'light',
        background: {
          default: prefersDarkMode ? '#222' : '#eee',
        },
        primary: {
          main: (prefersDarkMode ? config.theme.primaryDark : config.theme.primary) ?? config.theme.primary,
        },
        danger: { main: 'rgb(192,0,0)', contrastText: 'white' },
      },
    };
    return createTheme(theme);
  }, [prefersDarkMode, config.theme]);

  if (!store) {
    return <>Loading ...</>;
  }

  store.dispatch(ConfigActions.set({ organization: config.organization, dev: config.dev }));
  store.dispatch(AuthActions.set({ userInfo: user }));
  store.dispatch(OrgActions.set({ mine: myOrg }));

  let inner = children;
  if (!config.dev.noExternalNetwork) {
    inner = <GoogleOAuthProvider clientId={googleClient}>{inner}</GoogleOAuthProvider>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <ThemeProvider theme={hydratedTheme}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <PreferencesProvider>{inner}</PreferencesProvider>
          </LocalizationProvider>
        </ThemeProvider>
      </Provider>
    </QueryClientProvider>
  );
}
