import CategoryIcon from '@mui/icons-material/Category';
import { IconButton, Tooltip } from '@mui/material';
import React, { useState } from 'react';

export type EquipmentGrouping = 'All' | 'Type';

export function EquipmentGroupToggleButton({ onChange }: { onChange: (grouping: EquipmentGrouping) => void }): JSX.Element {
  const [selected, setSelected] = useState<EquipmentGrouping>('Type');

  const handleToggle = (): void => {
    const nextValue: EquipmentGrouping = selected === 'All' ? 'Type' : 'All';
    setSelected(nextValue);
    onChange(nextValue);
  };

  return (
    <Tooltip title={`Group by: ${selected}`}>
      <IconButton
        color={selected === 'Type' ? 'primary' : 'default'}
        aria-label={`Group by ${selected === 'All' ? 'Type' : 'All'}`}
        onClick={handleToggle}
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1, // Change to 0 for completely sharp 90° corners
          border: '1px solid',
          borderColor: selected === 'Type' ? 'primary.main' : 'divider',
        }}
      >
        <CategoryIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
