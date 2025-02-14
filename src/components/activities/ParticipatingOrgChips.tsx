import { BoxProps } from '@mui/material/Box';

import { Box } from '@respond/components/Material';
import { OrganizationChip } from '@respond/components/OrganizationChip';

import { useActivityContext } from './ActivityProvider';

export function ParticipatingOrgChips({ orgFilter, setOrgFilter, ...boxProps }: BoxProps & { orgFilter?: string; setOrgFilter?: (value: string) => void }) {
  const activity = useActivityContext();
  return (
    <Box {...boxProps}>
      <Box sx={{ my: 2 }}>
        {Object.entries(activity.organizations ?? {}).map(([id, org]) => (
          <OrganizationChip key={id} org={org} selected={orgFilter === id} onClick={() => setOrgFilter?.(orgFilter === id ? '' : id)} />
        ))}
      </Box>
    </Box>
  );
}
