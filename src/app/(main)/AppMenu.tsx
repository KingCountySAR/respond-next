'use client';

import * as React from 'react';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { AccountCircle } from '@mui/icons-material';

export function AppMenu() {
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement|null>(null);
  const handleMenu = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => setMenuAnchor(event.currentTarget);
  const handleClose = () => setMenuAnchor(null);

  return (
    <div style={{display:'inline-block'}}>
    <IconButton
      size="large"
      aria-label="account of current user"
      aria-controls="menu-appbar"
      aria-haspopup="true"
      onClick={handleMenu}
      color="inherit"
    >
      <AccountCircle />
    </IconButton>
    <Menu
      id="menu-appbar"
      anchorEl={menuAnchor}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      keepMounted
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      open={Boolean(menuAnchor)}
      onClose={handleClose}
    >
      <MenuItem disabled={true}>Placeholder</MenuItem>
      {/* {userInfo ? <MenuItem disabled>{userInfo.name}</MenuItem> : undefined}
      <MenuItem disabled={!userInfo} onClick={() => { handleClose(); dispatch(AuthActions['auth/logout']()) }}>Sign Out</MenuItem> */}
    </Menu>
    </div>
  );
}