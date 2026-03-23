import { useAuthContext } from '@respond/lib/authProvider'
import { LoginPanel } from '../components/LoginPanel'

export function LoginPage() {
  const auth = useAuthContext();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20vh', gap: 16 }}>
      <h1>Welcome</h1>
      {auth.loggedIn ? null : <LoginPanel />}
    </div>
  )
}