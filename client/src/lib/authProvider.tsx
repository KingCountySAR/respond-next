import { createContext, useContext } from 'react';
import { AuthStore, LoginUser } from '../store/authStore';
import { observer } from 'mobx-react-lite';

interface AuthContext {
  loggedIn: boolean
  user: LoginUser|undefined;
  logout: () => Promise<void>
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
