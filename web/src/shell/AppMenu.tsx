import AccountCircle from '@mui/icons-material/AccountCircle';
import { Divider, IconButton, Menu, MenuItem } from '@mui/material';
import { useState, type MouseEvent } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from './auth';
import { useDialogs } from './dialogs';
import { PreferencesDialog } from './PreferencesDialog';

export function AppMenu() {
  const { session, signOut } = useAuth();
  const { open } = useDialogs();
  const [, navigate] = useLocation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const handleMenu = (event: MouseEvent<HTMLButtonElement>) => setMenuAnchor(event.currentTarget);
  const handleClose = () => setMenuAnchor(null);

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
          {session ? <MenuItem disabled>{session.name}</MenuItem> : undefined}
          <MenuItem
            onClick={() => {
              handleClose();
              open(PreferencesDialog, {});
            }}
          >
            Preferences
          </MenuItem>
          {session?.admin && (
            <MenuItem
              onClick={() => {
                handleClose();
                navigate('~/admin/organizations');
              }}
            >
              Organizations
            </MenuItem>
          )}
          <MenuItem
            disabled={!session}
            onClick={() => {
              handleClose();
              void signOut();
            }}
          >
            Sign Out
          </MenuItem>
          <Divider />
          <MenuItem component="a" target="_blank" rel="noreferrer" href="https://github.com/KingCountySAR/respond-next/wiki/Quick-Start:-Mission-Responder">
            Quick Start Guide
          </MenuItem>
        </Menu>
      </div>
    </>
  );
}
