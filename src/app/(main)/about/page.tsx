'use client';
import { Box, Divider, Grid, Link, Paper, Stack, Typography } from '@mui/material';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';

const APP_BAR_OFFSET = 52;

export default function About() {
  return (
    <ToolbarPage maxWidth="lg">
      <Paper elevation={1} sx={{ p: 3 }}>
        <Stack direction={{ md: 'row' }} flex="1 1 auto" spacing={1} divider={<Divider orientation="vertical" flexItem />}>
          <Stack sx={{ mb: 4, minWidth: 175 }}>
            <AboutMenu />
          </Stack>
          <Stack>
            <AboutOverview />
            <div id="homepage" style={{ scrollMarginTop: APP_BAR_OFFSET }} />
            <AboutHomePage />
            <div id="activity" style={{ scrollMarginTop: APP_BAR_OFFSET }} />
            <AboutActivityPage />
            <div id="respond" style={{ scrollMarginTop: APP_BAR_OFFSET }} />
            <AboutResponding />
            <div id="sartopo" style={{ scrollMarginTop: APP_BAR_OFFSET }} />
            <AboutSartopo />
          </Stack>
        </Stack>
      </Paper>
    </ToolbarPage>
  );
}

function AboutMenu() {
  const buildId = useAppSelector((s) => s.config.dev.buildId);
  const buildCommit = buildId.split('-')[0];
  const buildUrl = buildCommit === 'development' ? '#' : `https://github.com/KingCountySAR/respond-next/commits/${buildCommit}`;
  return (
    <>
      <Typography variant="h6">Respond</Typography>
      <Typography variant="caption">
        Build: <Link href={buildUrl}>{buildId}</Link>
      </Typography>
      <Typography variant="caption">
        <Link href="https://forms.gle/VhMeCGUUbUHSw4or9">Submit Feature Request</Link>
      </Typography>

      <Grid container direction="column" spacing={2} sx={{ my: 1 }}>
        <Grid item>
          <Typography component={Link} href="#homepage">
            Home Page
          </Typography>
        </Grid>
        <Grid item>
          <Typography component={Link} href="#activity">
            Activity Page
          </Typography>
        </Grid>
        <Grid item>
          <Typography component={Link} href="#respond">
            Responding
          </Typography>
        </Grid>
        <Grid item>
          <Typography component={Link} href="#sartopo">
            SARTopo Map
          </Typography>
        </Grid>
      </Grid>
    </>
  );
}

function AboutOverview() {
  return (
    <>
      <Typography variant="h4">Respond Overview</Typography>
      <Typography sx={{ py: 2 }}>The Respond app is a mission management tool used to communicate mission information and enable responders to sign in to missions so that mission leadership knows how many responders are enroute.</Typography>
    </>
  );
}

function AboutHomePage() {
  return (
    <>
      <Typography variant="h4" sx={{ mt: 4 }}>
        Home Page
      </Typography>
      <Typography sx={{ py: 2 }}>The Home page provides an overview of recent, ongoing, and future activities.</Typography>

      <Typography variant="h6">My Activity</Typography>
      <Typography sx={{ py: 2 }}>The &quot;My Activity&quot; section contains an abbreviated list of the activities that you are currently involved with. It will only be present if are currently signed into, or on standby for, an activity.</Typography>

      <Typography variant="h6">Missions</Typography>
      <Typography sx={{ py: 2 }}>The &quot;Missions&quot; section will contain a list of missions that are currently active, or which concluded within the last 3 days. At present there is no option to view missions that are older than 3 days.</Typography>

      <Typography variant="h6">Events</Typography>
      <Typography sx={{ py: 2 }}>The &quot;Events&quot; section contains a list of Trainings or other Events that are currently active, or which concluded within the last 3 days. At present there is no option to view Events that are older than 3 days.</Typography>
    </>
  );
}

function AboutResponding() {
  return (
    <>
      <Typography variant="h4" sx={{ mt: 4 }}>
        Responding to a Mission
      </Typography>
      <Typography sx={{ py: 2 }}>The primary functionality of Respond is to enable members to sign in and report they are responding to a Mission, Training or other Event. It also provides a way for mission leadership to keep track of the status of responders and see their relevant qualifications. In the future, the timeline events will be used to automate roster entry into the database.</Typography>

      <Typography variant="h6">Signing Into an Activity</Typography>
      <Typography sx={{ py: 2 }}>By default, the button in each Mission or Event will indicate the expected next action, based on your current status. For example, if you have not signed in yet, or if you are on standby, it will say “Sign In”. Clicking Sign In will sign you into the Mission. Once you are signed in, the button will switch to Sign Out. Clicking it again will sign you out of the mission. Some statuses have a secondary option which appear in a dropdown menu.</Typography>

      <Typography variant="h6">Standby for a Future Activity</Typography>
      <Typography sx={{ py: 2 }}>Respond is introducing a new feature that enables you to indicate that you are available for a current or future mission, but are not currently responding. Missions that are scheduled to start in the future will default to Stand By; you will not be able to sign into a mission that has not started. To cancel, you can choose Sign Out from the dropdown menu.</Typography>
    </>
  );
}

function AboutActivityPage() {
  return (
    <>
      <Typography variant="h4" sx={{ mt: 4 }}>
        Activity Detail Page
      </Typography>
      <Typography sx={{ py: 2 }}>Clicking on any Mission or Event name will take you to a detail page where you can view the roster of everyone who has signed into the mission, view additional mission information, and access tools to edit a mission, or mark it as complete.</Typography>
      <Typography sx={{ pb: 2 }}>The roster shows each responder’s name, the time of their most recent status change, and a color indicator of their current status; At present, green means they are currently signed in, not green means they are on standby or signed out.</Typography>

      <Typography variant="h6">Edit Activity Details</Typography>
      <Typography sx={{ py: 2 }}>Clicking the Edit Button will open a form that allows you to edit the mission details.</Typography>

      <Typography variant="h6">Mark Activity as Complete</Typography>
      <Typography sx={{ py: 2 }}>Clicking Complete will mark the mission as completed. Anyone that was still signed into the mission will be signed out and the buttons to set your status for the mission will be hidden.</Typography>
      <Typography sx={{ pb: 2 }}>Activities that are marked &quot;Complete&quot; can be re-opened by clicking &quot;Reactivate&quot;</Typography>

      <Typography variant="h6">Delete an Activity</Typography>
      <Typography sx={{ py: 2 }}>Clicking the Red delete icon will delete the mission, which removes it from the Home Page.</Typography>
    </>
  );
}

function AboutSartopo() {
  return (
    <>
      <Typography variant="h4" sx={{ mt: 4 }}>
        SARTopo Map
      </Typography>
      <Stack direction={{ md: 'row' }}>
        <Box>
          <Typography sx={{ py: 2 }}>The Map Id is expected to be a SARTopo Map Id. Only the Id is required. For example if the Map URL is http://sartopo.com/m/ABC12 then the Id is &quot;ABC12&quot;</Typography>
          <Typography sx={{ pb: 2 }}>When a Map Id has been provided it will be shown as a link on the Mission Detail page and as a button with the SARTopo logo on the Activity tiles, on the home page. Clicking on either the link, or the button will open the map in a new browser tab.</Typography>
          <Typography sx={{ pb: 2 }}>If you are on a mobile device, the map may open in the Caltopo App directly. Based on feedback we have received, Android users may need to give Caltopo permission to open links:</Typography>
          <Typography sx={{ pb: 2 }}>
            <ol>
              <li>Open Settings -&gt; Apps -&gt; CalTopo -&gt; Open by default</li>
              <li>Tap on &quot;Add Link&quot;, then select all 3 options.</li>
              <li>The app should now open for CalTopo and SARTopo links.</li>
            </ol>
          </Typography>
        </Box>
        <Box sx={{ minWidth: 1 / 3, maxWidth: 300 }}>
          <img src="/about/activity-tile.jpg" alt="Activity Tile" width="100%" />
        </Box>
      </Stack>
    </>
  );
}
