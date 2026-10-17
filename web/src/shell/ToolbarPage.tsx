import CloudIcon from '@mui/icons-material/Cloud';
import NoCloudIcon from '@mui/icons-material/CloudOff';
import { Breakpoint, Container, Stack } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { useSyncStatus } from '@sync/client/react';
import { AppMenu } from './AppMenu';
import { useSite } from './App';
import { useSyncClient } from './sync';

/** The page frame every screen uses: the app bar (title, connection, account menu) over the content. */
export function ToolbarPage({ children, maxWidth }: { children: ReactNode; maxWidth?: false | Breakpoint }) {
  const { shortTitle } = useSite().organization;
  const connected = useSyncStatus(useSyncClient()).state === 'live';

  return (
    <Container maxWidth={maxWidth ?? 'md'} sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
      <CssBaseline />
      <AppBar sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, position: 'fixed' }}>
        <Toolbar sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            <Link href="~/" style={{ textDecoration: 'inherit', color: 'inherit' }}>
              {shortTitle} Check-In
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
      <Box className="toolbar-filler" sx={{ height: { xs: 56, sm: 64 }, flexShrink: 0 }} />
      <Box component="main" sx={{ display: 'flex', flexDirection: 'column', py: 2, flex: '1 1 auto', minHeight: 0 }}>
        {children}
      </Box>
    </Container>
  );
}
