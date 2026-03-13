import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@respond/lib/api';
import { Organization } from '@respond/types/organization';

const ORGANIZATIONS_QUERY_KEY = ['organizations'] as const;

export default function useOrganizations() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ORGANIZATIONS_QUERY_KEY,
    queryFn: async () => {
      const res = await apiFetch<{ data: Organization[] }>('/api/v1/organizations');
      return res.data;
    },
  });

  return { organizations: data ?? null, isLoading, isError, reload: refetch } as const;
}
