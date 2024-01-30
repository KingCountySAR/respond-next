'use client';

import AccountCircle from '@mui/icons-material/AccountCircle';
import { Divider, IconButton, Menu, MenuItem } from '@mui/material';
import Link from 'next/link';
import * as React from 'react';

import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { AuthActions } from '@respond/lib/client/store/auth';

import { PreferencesDialog } from './Preferences';

export function AppMenu() {
  const dispatch = useAppDispatch();
  const { userInfo } = useAppSelector((state) => state.auth);
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const handleMenu = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => setMenuAnchor(event.currentTarget);
  const handleClose = () => setMenuAnchor(null);

  const [openPreferences, setOpenPreferences] = React.useState(false);
  const handleOpenPreferences = () => {
    setOpenPreferences(true);
  };
  const handleClosePreferences = () => setOpenPreferences(false);

  return (
    <>
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
            onClick={() => {
              handleClose();
              handleOpenPreferences();
            }}
          >
            Preferences
          </MenuItem>
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
      <PreferencesDialog open={openPreferences} onClose={handleClosePreferences} />
    </>
  );
}
