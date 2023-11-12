import { BoxProps } from '@mui/material/Box';

import { Box } from '@respond/components/Material';
import { OrganizationChip } from '@respond/components/OrganizationChip';
import { Activity } from '@respond/types/activity';

export function ParticipatingOrgChips({ activity, orgFilter, setOrgFilter, ...boxProps }: BoxProps & { activity: Activity; orgFilter?: string; setOrgFilter?: (value: string) => void }) {
  return (
    <Box {...boxProps}>
      <Box sx={{ my: 2 }}>
        {Object.entries(activity.organizations ?? {}).map(([id, org]) => (
          <OrganizationChip key={id} org={org} activity={activity} selected={orgFilter === id} onClick={() => setOrgFilter?.(orgFilter === id ? '' : id)} />
        ))}
      </Box>
    </Box>
  );
}
