import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import App from './App';
import { AuthProvider } from './lib/authProvider';
import { loadBootData } from './lib/bootLoader';
import { ConfigProvider } from './lib/configProvider';
import { AuthStore } from './store/authStore';
import { ConfigStore } from './store/configStore';

async function boot() {
  const bootData = await loadBootData();
  const configStore = new ConfigStore(bootData.environment);
  const authStore = new AuthStore(bootData.googleClientId, bootData.login);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ConfigProvider store={configStore}>
        <AuthProvider store={authStore}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ConfigProvider>
    </StrictMode>
  );
}
boot();
