import StarIcon from '@mui/icons-material/Star';
import { IconButton, Tooltip } from '@mui/material';
import React, { useState } from 'react';

export function CommsFavoriteToggleButton({ onChange }: { onChange: (isSelected: boolean) => void }): JSX.Element {
  const [selected, setSelected] = useState<boolean>(false);

  const handleToggle = (): void => {
    const nextState = !selected;
    setSelected(nextState);
    onChange(nextState);
  };

  return (
    <Tooltip title={selected ? 'Show all messages' : 'Show favorites only'}>
      <IconButton
        color={selected ? 'primary' : 'default'}
        aria-label={selected ? 'Show all messages' : 'Show favorites only'}
        onClick={handleToggle}
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          border: '1px solid',
          borderColor: selected ? 'primary.main' : 'divider',
        }}
      >
        <StarIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
