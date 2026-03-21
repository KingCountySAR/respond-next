import { LoginButton } from '../components/LoginButton'
import { AuthStore } from '../store/authStore'

interface Props {
  auth: AuthStore
}


export function LoginPage({ auth }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20vh', gap: 16 }}>
      <h1>Welcome</h1>
      {auth.loggedIn ? null : <LoginButton store={auth} />}
    </div>
  )
}