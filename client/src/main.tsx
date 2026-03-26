import { ThemeProvider } from '@mui/material/styles';
import { observer } from 'mobx-react-lite';
import { PropsWithChildren, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { AuthProvider, useAuthContext } from './lib/authProvider';
import { loadBootData } from './lib/bootLoader';
import { ConfigProvider, useConfigContext } from './lib/configProvider';
import { LoginPage } from './pages/LoginPage';
import { ActivitiesProvider, ActivitiesStore } from './store/activitiesStore';
import { AuthStore } from './store/authStore';
import { ConfigStore } from './store/configStore';
import { LocationsProvider, LocationsStore } from './store/locationsStore';

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
  const locationsStore = new LocationsStore();

  const activitiesStore = new ActivitiesStore('participantid');

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ConfigProvider store={configStore}>
        <AuthProvider store={authStore}>
          <ObservableThemeProvider>
            <AppLoginGuard>
              <LocationsProvider store={locationsStore}>
                <ActivitiesProvider store={activitiesStore}>
                  <App />
                </ActivitiesProvider>
              </LocationsProvider>
            </AppLoginGuard>
          </ObservableThemeProvider>
        </AuthProvider>
      </ConfigProvider>
    </StrictMode>
  );
}
boot();
