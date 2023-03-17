import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import { getOrganizationForRequest } from '@respond/lib/server/request';
import { headers } from 'next/headers';
import ClientProviders, { SiteConfig } from './ClientProviders';
import "./globals.css"

export const metadata = {
  title: 'Respond Site',
  description: 'Respond to search and rescue activities',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const hdrs = headers();
  
  const org = await getOrganizationForRequest();
  const siteConfig: SiteConfig = {
    dev: {
      noExternalNetwork: !!process.env.DEV_NETWORK_DISABLED
    },
    organization: {
      title: org?.title ?? 'Team',
      shortTitle: org?.rosterName ?? org?.title ?? 'Team',
    },
    theme: {
      palette: {
        primary: { main: org?.brand.primary ?? 'rgb(200, 100, 100)' },
        danger: { main: 'rgb(192,0,0)', contrastText: 'white' },
      },
    }
  };

  const user = userFromAuth(await getCookieAuth());

  console.log('headers', hdrs.get('host'));
  return (
    <html lang="en">
      <head />
      <body>
        <ClientProviders googleClient={process.env.GOOGLE_ID ?? ''} config={siteConfig} user={user}>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}