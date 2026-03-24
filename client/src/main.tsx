import { ThemeProvider } from '@mui/material/styles';
import { observer } from 'mobx-react-lite';
import { PropsWithChildren, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import App from './App';
import { AuthProvider, useAuthContext } from './lib/authProvider';
import { loadBootData } from './lib/bootLoader';
import { ConfigProvider, useConfigContext } from './lib/configProvider';
import { LoginPage } from './pages/LoginPage';
import { ActivitiesProvider, ActivitiesStore } from './store/activitiesStore';
import { AuthStore } from './store/authStore';
import { ConfigStore } from './store/configStore';

const ObservableThemeProvider = observer(({ children }: PropsWithChildren<unknown>) => {
  const config = useConfigContext();

  return (
    <ThemeProvider theme={config.theme}>
      {children}
    </ThemeProvider>
  );
});

const AppLoginGuard = observer(({ children }: PropsWithChildren<unknown>) => {
  const auth = useAuthContext();
  return auth.loggedIn ? children : (<LoginPage />);
});

async function boot() {
  const bootData = await loadBootData();
  const configStore = new ConfigStore(bootData.environment);
  const authStore = new AuthStore(bootData.googleClientId, bootData.login);

  const activitiesStore = new ActivitiesStore('participantid');

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ConfigProvider store={configStore}>
        <AuthProvider store={authStore}>
          <BrowserRouter>
            <ObservableThemeProvider>
              <AppLoginGuard>
                <ActivitiesProvider store={activitiesStore}>
                  <App />
                </ActivitiesProvider>
              </AppLoginGuard>
            </ObservableThemeProvider>
          </BrowserRouter>
        </AuthProvider>
      </ConfigProvider>
    </StrictMode>
  );
}
boot();
