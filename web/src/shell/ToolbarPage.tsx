import CloudIcon from '@mui/icons-material/Cloud';
import NoCloudIcon from '@mui/icons-material/CloudOff';
import CoPresentIcon from '@mui/icons-material/CoPresent';
import HikingIcon from '@mui/icons-material/Hiking';
import { Breakpoint, Container, IconButton, Stack } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useBrowserLocation } from 'wouter/use-browser-location';
import { useSyncStatus } from '@sync/client/react';
import { observer, useActivityList } from '@sync/model/react';
import { AppMenu } from './AppMenu';
import { useSite } from './App';
import { useAuth } from './auth';
import { useSyncClient } from './sync';

/** The page frame every screen uses: the app bar (title, connection, account menu) over the content. */
export function ToolbarPage({ children, maxWidth }: { children: ReactNode; maxWidth?: false | Breakpoint }) {
  const { shortTitle } = useSite().organization;
  const connected = useSyncStatus(useSyncClient()).state === 'live';
  const [path] = useBrowserLocation();
  const inOps = OPS_PATH.test(path);

  return (
    <Container maxWidth={maxWidth ?? 'md'} sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
      <CssBaseline />
      <AppBar sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, position: 'fixed' }}>
        <Toolbar sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            <Link href={inOps ? '~/ops' : '~/'} style={{ textDecoration: 'inherit', color: 'inherit' }}>
              {shortTitle} Check-In
            </Link>
          </Typography>
          <Typography variant="h6" noWrap component="div">
            <Stack
              direction="row"
              sx={{
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              {inOps ? <RespondButton path={path} /> : <OpsButton path={path} />}
              {/* Padded as a large IconButton is, so it lines up with the buttons beside it. */}
              <Box sx={{ display: 'inline-flex', p: 1.5 }} title={connected ? 'Connected' : 'Offline'}>
                {connected ? <CloudIcon fontSize="medium" /> : <NoCloudIcon fontSize="medium" />}
              </Box>
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

// The ops section, and the pages there or in the respond section about one activity.
const OPS_PATH = /^\/ops(?:\/|$)/;
const OPS_ACTIVITY_PATH = /^\/ops\/([^/]+)/;
const ACTIVITY_PATH = /^\/(?:mission|event)\/([^/]+)/;

// The toolbar sits inside nested routes, so these read the browser's path, which ToolbarPage passes them.

/** For managers outside the ops section: the dashboard of the activity being looked at, or the ops home. */
function OpsButton({ path }: { path: string }) {
  const { session } = useAuth();
  const manager = session?.tier === 'manage';
  // The ops section's code, fetched ahead so following the button doesn't wait on it.
  useEffect(() => {
    if (manager) void import('../sections/ops');
  }, [manager]);
  if (!manager) return null;
  const activityId = ACTIVITY_PATH.exec(path)?.[1];
  const href = activityId && activityId !== 'new' ? `~/ops/${activityId}` : '~/ops';
  return (
    <IconButton component={Link} href={href} size="large" color="inherit" aria-label="Operations" title="Operations">
      <CoPresentIcon fontSize="medium" />
    </IconButton>
  );
}

/** In the ops section: back to the respond side, to the activity's page from its dashboard, else Home. */
const RespondButton = observer(function RespondButton({ path }: { path: string }) {
  const list = useActivityList(useSyncClient());
  const activityId = OPS_ACTIVITY_PATH.exec(path)?.[1];
  // Until the list says which, an activity's page works under either path.
  const href = activityId ? `~/${list?.item(activityId)?.isMission === false ? 'event' : 'mission'}/${activityId}` : '~/';
  return (
    <IconButton component={Link} href={href} size="large" color="inherit" aria-label="Respond" title="Respond">
      <HikingIcon fontSize="medium" />
    </IconButton>
  );
});
