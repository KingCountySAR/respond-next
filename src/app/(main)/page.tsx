import { Inter } from 'next/font/google';
//import styles from './page.module.css';
import AppBar from './AppBar';
import { getCookieAuth } from "@respond/lib/server/auth";

import LoginPanel from '../LoginPanel';

const inter = Inter({ subsets: ['latin'] })

export default async function Home() {
  const auth = await getCookieAuth();
  return (
    <main>
      <div>Auth: {JSON.stringify(auth)}</div>
      <AppBar />
      <div>{process.env.GOOGLE_ID}</div>
      <LoginPanel />
    </main>
  )
}