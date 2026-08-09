import { CopyChip } from '../CopyChip';

export function DashboardCopyChip({ value }: { value: string }) {
  return (
    <CopyChip
      value={value}
      size="small"
      variant="outlined"
      sx={{
        mt: 1,
        boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
        transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background-color 120ms ease',
        ':hover': {
          bgcolor: 'grey.50',
          borderColor: 'primary.light',
          boxShadow: '0 6px 14px rgba(16,24,40,0.12)',
          '& .drag-handle': {
            opacity: 0.9,
          },
        },
      }}
    />
  );
}
