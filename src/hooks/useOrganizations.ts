import * as React from 'react';

import { apiFetch } from '@respond/lib/api';
import { OrganizationDoc } from '@respond/types/data/organizationDoc';

type OrganizationOption = Pick<OrganizationDoc, 'id' | 'title'>;

let cachedOrgs: OrganizationOption[] | null = null;

export default function useOrganizations() {
  const [organizations, setOrganizations] = React.useState<OrganizationOption[] | null>(cachedOrgs);
  const [loading, setLoading] = React.useState<boolean>(!cachedOrgs);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: OrganizationOption[] }>('/api/v1/organizations');
      cachedOrgs = res.data;
      setOrganizations(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!cachedOrgs) {
      load();
    }
  }, [load]);

  const reload = React.useCallback(() => {
    // clear cache and reload
    cachedOrgs = null;
    load();
  }, [load]);

  return { organizations, loading, reload } as const;
}

export type { OrganizationOption };
