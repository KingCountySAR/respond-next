import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { IconButton, Tooltip } from '@mui/material';
import React, { useState } from 'react';

export function CommsAutomatedToggleButton({ onChange }: { onChange: (isHidden: boolean) => void }): JSX.Element {
  const [hidden, setHidden] = useState<boolean>(false);

  const handleToggle = (): void => {
    const next = !hidden;
    setHidden(next);
    onChange(next);
  };

  return (
    <Tooltip title={hidden ? 'Show automated logs' : 'Hide automated logs'}>
      <IconButton
        color={hidden ? 'default' : 'primary'}
        aria-label={hidden ? 'Show automated logs' : 'Hide automated logs'}
        onClick={handleToggle}
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          border: '1px solid',
          borderColor: hidden ? 'divider' : 'primary.main',
        }}
      >
        <SmartToyOutlinedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
