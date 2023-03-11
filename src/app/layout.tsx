import { headers } from 'next/headers';
import { Session } from 'next-auth';
import AuthContext from './AuthContext';
import "./globals.css"

export const metadata = {
  title: 'Create Next App',
  description: 'Generated by create next app',
}


async function getSession(cookie: string): Promise<Session> {
  const response = await fetch(`${process.env.LOCAL_AUTH_URL ?? 'http://localhost:3000'}/api/auth/session`,
  {
    headers: {
      cookie,
    },
  });
  const session = await response.json();
  return Object.keys(session).length > 0 ? session : null;
}


export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession(headers().get('cookie') ?? '');
  return (
    <html lang="en">
      <head />
      <body>
        <AuthContext session={session}>
          {children}
        </AuthContext>
      </body>
    </html>
  )
}
