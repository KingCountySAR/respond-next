import { createContext, useContext } from 'react';
import { observer } from 'mobx-react-lite';
import { AuthStore } from '../store/authStore';
import { ClientLogin } from '@app/shared';

interface AuthContext {
  readonly working: boolean
  readonly loggedIn: boolean
  readonly user: ClientLogin|undefined
  logout(): Promise<void>
  setupButton(button: HTMLDivElement): Promise<void>
}

const AuthContextInstance = createContext<AuthContext | null>(null);

export const AuthProvider = observer(({ store, children }: { store: AuthStore; children: React.ReactNode }) => (
  <AuthContextInstance.Provider value={store}>{children}</AuthContextInstance.Provider>
))

export const useAuthContext = () => {
  const authContext = useContext(AuthContextInstance);

  if (!authContext) {
    throw new Error('useAuthContext must be used within <AuthProvider>');
  }

  return authContext;
};