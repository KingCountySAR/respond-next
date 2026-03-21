import { useAuth } from './lib/useAuth'
//import { useSSE } from './lib/useSSE'
import { useState } from 'react'

function LoginPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20vh', gap: 16 }}>
      <h1>Welcome</h1>
      <a href="/auth/google">
        <button>Sign in with Google</button>
      </a>
    </div>
  )
}

function AppPage() {
  const { user, logout } = useAuth()
  const [updates, setUpdates] = useState<string[]>([])

  // useSSE({
  //   url: '/events/stream',
  //   onMessage: (_, data) => {
  //     setUpdates((prev) => [`${new Date().toLocaleTimeString()} — ${JSON.stringify(data)}`, ...prev.slice(0, 19)])
  //   },
  // })

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {user?.picture && <img src={user.picture} style={{ width: 32, borderRadius: '50%', marginRight: 8 }} />}
          <strong>{user?.name}</strong> — {user?.email}
        </div>
        <button onClick={logout}>Sign out</button>
      </div>

      <hr />

      <h2>Live Updates</h2>
      <ul>
        {updates.map((u, i) => (
          <li key={i}>{u}</li>
        ))}
      </ul>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  return user ? <AppPage /> : <LoginPage />
}