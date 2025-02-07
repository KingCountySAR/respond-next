'use client';

import CloudIcon from '@mui/icons-material/Cloud';
import NoCloudIcon from '@mui/icons-material/CloudOff';
import { Breakpoint, Container, Stack } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import * as React from 'react';

import { AppMenu } from '@respond/components/AppMenu';
import LoginPanel from '@respond/components/LoginPanel';
import { useAppSelector } from '@respond/lib/client/store';

export function ToolbarPage({ children, maxWidth }: { children: React.ReactNode; maxWidth?: false | Breakpoint }) {
  const { shortTitle } = useAppSelector((state) => state.config.organization);
  const { userInfo } = useAppSelector((state) => state.auth);
  const { connected } = useAppSelector((state) => state.sync);
  if (!userInfo) {
    children = <LoginPanel />;
  }

  return (
    <Container maxWidth={maxWidth ?? 'md'} sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            <Link href="/" style={{ textDecoration: 'inherit', color: 'inherit' }}>
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
      <Box className="toolbar-filler" sx={{ height: { xs: 56, sm: 64 } }} />
      <Box component="main" sx={{ py: 2 }} flex="1 1 auto" display="flex" flexDirection="column">
        {children}
      </Box>
    </Container>
  );
}
