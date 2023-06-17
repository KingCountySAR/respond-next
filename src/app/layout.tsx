import ClientOnly from '@respond/components/ClientOnly';
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
      noExternalNetwork: !!process.env.DEV_NETWORK_DISABLED,
      buildId: process.env.CONFIG_BUILD_ID ?? 'unknown',
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
  const myOrg = (user && org) ? {
    id: org.id,
    rosterName: org.rosterName,
    mouName: org.mouName,
    title: org.title,
    canCreateMissions: org.canCreateMissions,
    canCreateEvents: org.canCreateEvents,
    partners: org.partners?.map(p => ({
      id: p.id,
      title: p.title,
      rosterName: p.rosterName,
      canCreateMissions: p.canCreateMissions,
      canCreateEvents: p.canCreateEvents,
    })) ?? [],
  } : undefined;

  return (
    <html lang="en">
      <head />
      <body id="root">
        <ClientOnly>
          <ClientProviders googleClient={process.env.GOOGLE_ID ?? ''} config={siteConfig} user={user} myOrg={myOrg}>
            {children}
          </ClientProviders>
        </ClientOnly>
      </body>
    </html>
  )
}