import { createContext, useContext } from 'react';

import { ConfigContext } from '@respond/store/configStore';

const ConfigContextInstance = createContext<ConfigContext | null>(null);

export const ConfigProvider = ({ store, children }: { store: ConfigContext; children: React.ReactNode }) => (
  <ConfigContextInstance.Provider value={store}>{children}</ConfigContextInstance.Provider>
);

export const useConfigContext = () => {
  const ConfigContext = useContext(ConfigContextInstance);

  if (!ConfigContext) {
    throw new Error('useConfigContext must be used within <ConfigProvider>');
  }

  return ConfigContext;
};
