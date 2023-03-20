'use client';

import { createTheme, ThemeOptions, ThemeProvider } from '@mui/material';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ReactNode } from 'react';

import { store } from '@respond/lib/client/store';
import { Provider } from 'react-redux';
import { ConfigActions } from '@respond/lib/client/store/config';
import { UserInfo } from '@respond/types/userInfo';
import { AuthActions } from '@respond/lib/client/store/auth';
import { MyOrganization } from '@respond/types/organization';
import { OrgActions } from '@respond/lib/client/store/organization';

export interface SiteConfig {
  theme: ThemeOptions;
  dev: { noExternalNetwork: boolean };
  organization: { title: string, shortTitle: string };
}

export default function ClientProviders(
  { googleClient, config, user, myOrg, children }:
  { googleClient: string, config: SiteConfig, user?: UserInfo, myOrg?: MyOrganization, children: ReactNode}
) {
  console.log('rendering theme');
  const hydratedTheme = createTheme(config.theme);
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