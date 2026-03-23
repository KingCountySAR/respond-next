import CloudIcon from '@mui/icons-material/Cloud';
import NoCloudIcon from '@mui/icons-material/CloudOff';
import { Breakpoint, Container, Stack } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { Link } from 'react-router';

import { AppMenu } from '@respond/components/AppMenu';
import { LoginPanel } from '@respond/components/LoginPanel';
import { useAuthContext } from '@respond/lib/authProvider';
import { useConfigContext } from '@respond/lib/configProvider';



export const ToolbarPage = observer(({ children, maxWidth }: { children: React.ReactNode; maxWidth?: false | Breakpoint }) => {
  // const { connected } = useAppSelector((state) => state.sync);
  const connected = true;
  const config = useConfigContext();
  const auth = useAuthContext();

  if (!auth.loggedIn) {
    children = <LoginPanel />;
  }

  return (
    <Container maxWidth={maxWidth ?? 'md'} sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            <Link to="/" style={{ textDecoration: 'inherit', color: 'inherit' }}>
              {config.env.shortTitle} Check-In
            </Link>
          </Typography>
          <Typography variant="h6" noWrap component="div">
            <Stack
              direction="row"
              spacing={2}
              sx={{
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              {connected ? <CloudIcon fontSize="medium" /> : <NoCloudIcon fontSize="medium" />}
            </Stack>
          </Typography>
          <AppMenu />
        </Toolbar>
      </AppBar>
      <Box className="toolbar-filler" sx={{ height: { xs: 56, sm: 64 } }} />
      <Box component="main" sx={{ py: 2 }} flex="1 1 auto" display="flex" flexDirection="column">
        {children}
      </Box>
    </Container>
  );
});
