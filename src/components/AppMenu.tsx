'use client';

import AccountCircle from '@mui/icons-material/AccountCircle';
import { Divider, IconButton, Link, Menu, MenuItem } from '@mui/material';
import * as React from 'react';

import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { AuthActions } from '@respond/lib/client/store/auth';

export function AppMenu() {
  const dispatch = useAppDispatch();
  const { userInfo } = useAppSelector((state) => state.auth);
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const handleMenu = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => setMenuAnchor(event.currentTarget);
  const handleClose = () => setMenuAnchor(null);
  return (
    <div style={{ display: 'inline-block' }}>
      <IconButton size="large" aria-label="account of current user" aria-controls="menu-appbar" aria-haspopup="true" onClick={handleMenu} color="inherit">
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
        {userInfo ? <MenuItem disabled>{userInfo.name}</MenuItem> : undefined}
        <MenuItem
          disabled={!userInfo}
          onClick={() => {
            handleClose();
            dispatch(AuthActions.logout());
          }}
        >
          Sign Out
        </MenuItem>
        <Divider />
        <MenuItem component={Link} href="/about">
          About
        </MenuItem>
      </Menu>
    </div>
  );
}
