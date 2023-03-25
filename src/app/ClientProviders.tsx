'use client';

import { createTheme, ThemeOptions, ThemeProvider, useMediaQuery } from '@mui/material';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ReactNode, useEffect, useMemo, useState } from 'react';

import { Provider } from 'react-redux';
import { ConfigActions } from '@respond/lib/client/store/config';
import { UserInfo } from '@respond/types/userInfo';
import { AuthActions } from '@respond/lib/client/store/auth';
import { MyOrganization } from '@respond/types/organization';
import { OrgActions } from '@respond/lib/client/store/organization';
import { AppStore, buildClientStore } from '@respond/lib/client/store';
import { ClientSync } from '@respond/lib/client/sync';
import merge from 'lodash.merge';

export interface SiteConfig {
  theme: ThemeOptions;
  dev: { noExternalNetwork: boolean };
  organization: { title: string, shortTitle: string };
}

export default function ClientProviders(
  { googleClient, config, user, myOrg, children }:
  { googleClient: string, config: SiteConfig, user?: UserInfo, myOrg?: MyOrganization, children: ReactNode}
) {
  const [ store ] = useState<AppStore>(buildClientStore([]));
  const [ sync ] = useState<ClientSync>(new ClientSync(store));

  useEffect(() => {
    console.log('ClientProviders mounting ...');
    sync.start();
  }, [sync]);

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const hydratedTheme = useMemo(() => {
    console.log('rendering theme');
    const theme = merge({}, config.theme, { palette: { mode: prefersDarkMode ? 'dark' : 'light'}});
    return createTheme(theme);
  }, [ prefersDarkMode, config.theme ]);


  if (!store) {
    return (<>Loading ...</>)
  }

  store.dispatch(ConfigActions.set({ organization: config.organization, dev: config.dev }));
  store.dispatch(AuthActions.set({ userInfo: user }));
  store.dispatch(OrgActions.set({ mine: myOrg }));
  
  let inner = children;
  if (!config.dev.noExternalNetwork) {
    inner = (<GoogleOAuthProvider clientId={googleClient}>{inner}</GoogleOAuthProvider>);
  }

  return (
    <Provider store={store}>
      <ThemeProvider theme={hydratedTheme}>
        {inner}
      </ThemeProvider>
    </Provider>
  )
}