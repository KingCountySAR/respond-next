import { LoginPage } from './pages/LoginPage'
import { useMemo } from 'react'
import { AuthStore } from './store/authStore'
import { observer } from 'mobx-react-lite'
import { AuthProvider, useAuthContext } from './lib/authProvider'

const AppPage = observer(() => {
  // useSSE({
  //   url: '/api/events/stream',
  //   onMessage: (_, data) => {
  //     setUpdates((prev) => [`${new Date().toLocaleTimeString()} — ${JSON.stringify(data)}`, ...prev.slice(0, 19)])
  //   },
  // })
  const { logout, user } = useAuthContext()

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {/* {user?.picture && <img src={user.picture} style={{ width: 32, borderRadius: '50%', marginRight: 8 }} />} */}
          <strong>{user?.name}</strong> — {user?.email}
        </div>
        <button onClick={logout}>Sign out</button>
      </div>
      <hr />
      <h2>Live Updates</h2>
      <ul>
        {/*updates.map((u, i) => <li key={i}>{u}</li>)*/}
      </ul>
    </div>
  )
})

const AppContent = observer(({ auth }: { auth: AuthStore }) => {
  return auth.loggedIn ? <AppPage /> : <LoginPage auth={auth} />
})

export default function App() {
  const authStore = useMemo(() => {
    const store = new AuthStore()
    store.init()
    return store
  }, [])

  return (
    <AuthProvider store={authStore}>
      <AppContent auth={authStore} />
    </AuthProvider>
  )
}