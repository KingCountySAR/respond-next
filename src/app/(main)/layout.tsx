'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { Container } from '@mui/material';
import { AppMenu } from './AppMenu';
import { useAppSelector } from '@respond/lib/client/store';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { shortTitle } = useAppSelector(state => state.config.organization )
  return (
    <Container maxWidth="md" sx={{ display: 'flex', flexDirection:'column' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          {shortTitle} Check-In
        </Typography>
        <Typography variant="h6" noWrap component="div">
        {/* {appChrome.online ? undefined : <div>OFF</div>} */}
        </Typography>
        <AppMenu />
      </Toolbar>
      </AppBar>
      <Box className="toolbar-filler" sx={{height: { xs: 56, sm: 64 }}}/>
      <Box component="main" sx={{ flexGrow: 1, pt: 2 }}>
        {children}
      </Box>
    </Container>
  )
}