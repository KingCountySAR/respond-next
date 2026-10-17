import AccountCircle from '@mui/icons-material/AccountCircle';
import { Divider, IconButton, Menu, MenuItem } from '@mui/material';
import { useState, type MouseEvent } from 'react';
import { useAuth } from './auth';

export function AppMenu() {
  const { session, signOut } = useAuth();
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
          {/* The legacy Preferences dialog comes over with the field pages. */}
          <MenuItem disabled>Preferences</MenuItem>
          <MenuItem
            disabled={!session}
            onClick={() => {
              handleClose();
              signOut();
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
