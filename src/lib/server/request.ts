import { headers } from 'next/headers';

import { getOrganizationForDomain } from './mongodb';

export async function getOrganizationForRequest() {
  const host = headers().get('host')?.split(':')[0];
  if (!host) {
    return undefined;
  }

  const org = await getOrganizationForDomain(host);
  return org;
}
