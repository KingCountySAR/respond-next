import { observer } from 'mobx-react-lite';

import { ToolbarPage } from '@respond/components/ToolbarPage';

import { useAuthContext } from './lib/authProvider';
import { LoginPage } from './pages/LoginPage';

const AppPage = observer(() => {
  // useSSE({
  //   url: '/api/events/stream',
  //   onMessage: (_, data) => {
  //     setUpdates((prev) => [`${new Date().toLocaleTimeString()} — ${JSON.stringify(data)}`, ...prev.slice(0, 19)])
  //   },
  // })
  const { logout, user } = useAuthContext();

  return (
    <ToolbarPage>
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
    </ToolbarPage>
  );
});

const App = observer(() => {
  const auth = useAuthContext();
  return auth.loggedIn ? <AppPage /> : <LoginPage />;
});

export default App;
