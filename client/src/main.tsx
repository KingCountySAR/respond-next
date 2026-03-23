import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ConfigStore } from './store/configStore';
import { AuthStore } from './store/authStore';
import { loadBootData } from './lib/bootLoader';
import { ConfigProvider } from './lib/configProvider';
import { AuthProvider } from './lib/authProvider';
import App from './App';

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