import AccountCircle from '@mui/icons-material/AccountCircle';
import { Divider, IconButton, Menu, MenuItem } from '@mui/material';
import { Link } from 'react-router';
import * as React from 'react';
import { useAuthContext } from '@respond/lib/authProvider';

// import { PreferencesDialog } from './Preferences';

export function AppMenu() {
  const auth = useAuthContext();
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
          {auth.loggedIn ? <MenuItem disabled>{auth.user!.name}</MenuItem> : undefined}
          <MenuItem
            onClick={() => {
              handleClose();
              handleOpenPreferences();
            }}
          >
            Preferences
          </MenuItem>
          <MenuItem
            disabled={!auth.loggedIn}
            onClick={() => {
              handleClose();
              auth.logout();
            }}
          >
            Sign Out
          </MenuItem>
          <Divider />
          <MenuItem component={Link} to="/about">
            About
          </MenuItem>
        </Menu>
      </div>
      {/* <PreferencesDialog open={openPreferences} onClose={handleClosePreferences} /> */}
    </>
  );
}
