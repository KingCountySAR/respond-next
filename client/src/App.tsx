import { observer } from 'mobx-react-lite';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { useAuthContext } from './lib/authProvider';
import { LoginPage } from './pages/LoginPage';
import routes from './pages/Routes';

// const AppPage = observer(() => {
//   // useSSE({
//   //   url: '/api/events/stream',
//   //   onMessage: (_, data) => {
//   //     setUpdates((prev) => [`${new Date().toLocaleTimeString()} — ${JSON.stringify(data)}`, ...prev.slice(0, 19)])
//   //   },
//   // })
//   const { logout, user } = useAuthContext();

//   return (
//     <ToolbarPage>
//       <div style={{ padding: 32 }}>
//         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//           <div>
//             {/* {user?.picture && <img src={user.picture} style={{ width: 32, borderRadius: '50%', marginRight: 8 }} />} */}
//             <strong>{user?.name}</strong> — {user?.email}
//           </div>
//           <button onClick={logout}>Sign out</button>
//         </div>
//         <hr />
//         <h2>Live Updates</h2>
//         <Button color="primary" variant="contained">Test Me</Button>
//         <ul>
//           {/*updates.map((u, i) => <li key={i}>{u}</li>)*/}
//         </ul>
//       </div>
//     </ToolbarPage>
//   );
// });

const router = createBrowserRouter([
  ...routes
]);

const App = observer(() => {
  const auth = useAuthContext();
  return auth.loggedIn ? <RouterProvider router={router}/> : <LoginPage />;
});

export default App;
