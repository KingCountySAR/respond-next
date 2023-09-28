import ClientOnly from '@respond/components/ClientOnly';
import { getCookieAuth, userFromAuth } from '@respond/lib/server/auth';
import { getOrganizationForRequest } from '@respond/lib/server/request';
import { MyOrganization } from '@respond/types/organization';

import ClientProviders, { SiteConfig } from './ClientProviders';
import './globals.css';

export const metadata = {
  title: 'Respond Site',
  description: 'Respond to search and rescue activities',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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
      primary: org?.brand.primary ?? 'rgb(200, 100, 100)',
      primaryDark: org?.brand.primaryDark,
    },
  };

  const user = userFromAuth(await getCookieAuth());
  const myOrg: MyOrganization | undefined =
    user && org
      ? {
          id: org.id,
          rosterName: org.rosterName,
          title: org.title,
          canCreateMissions: org.canCreateMissions,
          canCreateEvents: org.canCreateEvents,
          memberProvider: org.memberProvider.provider,
          supportEmail: org.supportEmail,
          partners:
            org.partners?.map((p) => ({
              id: p.id,
              title: p.title,
              rosterName: p.rosterName,
              canCreateMissions: p.canCreateMissions,
              canCreateEvents: p.canCreateEvents,
            })) ?? [],
        }
      : undefined;

  const faviconUrl = org?.brand.faviconUrl;
  const homeScreenIconUrl = org?.brand.homeScreenIconUrl;

  return (
    <html lang="en">
      <head>
        {faviconUrl && <link rel="icon" href={faviconUrl} />}
        {homeScreenIconUrl && <link rel="apple-touch-icon" href={homeScreenIconUrl} />}
      </head>
      <body id="root">
        <ClientOnly>
          <ClientProviders googleClient={process.env.GOOGLE_ID ?? ''} config={siteConfig} user={user} myOrg={myOrg}>
            {children}
          </ClientProviders>
        </ClientOnly>
      </body>
    </html>
  );
}
