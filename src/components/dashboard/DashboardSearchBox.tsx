import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, InputAdornment, SxProps, TextField, Theme } from '@mui/material';
import { useState } from 'react';

export function DashboardSearchBox({ placeholder, onChange, sx }: { placeholder?: string; onChange: (value: string) => void; sx?: SxProps<Theme> | undefined }) {
  const [searchQuery, setSearchQuery] = useState('');
  const handleChange = (value: string) => {
    setSearchQuery(value);
    onChange(value);
  };
  return (
    <Box sx={sx}>
      <TextField
        size="small"
        placeholder={placeholder || 'Search...'}
        fullWidth
        value={searchQuery}
        onChange={(e) => handleChange(e.target.value)}
        sx={{ '& .MuiInputBase-root': { height: 32 } }}
        InputProps={{
          endAdornment: searchQuery ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => handleChange('')} aria-label="clear search">
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        }}
      />
    </Box>
  );
}
