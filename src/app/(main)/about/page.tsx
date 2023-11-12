'use client';
import { Box, Divider, Grid, Paper, Stack, Typography } from '@mui/material';
import { Variant } from '@mui/material/styles/createTypography';
import Link from 'next/link';

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
            <AboutHomePage />
            <AboutActivityPage />
            <AboutResponding />
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
      <Section variant="h4" title="Respond Overview" mt={0}>
        <Paragraph>The Respond app is a mission management tool used to communicate mission information and enable responders to sign in to missions so that mission leadership knows how many responders are enroute.</Paragraph>
      </Section>
    </>
  );
}

function AboutHomePage() {
  return (
    <Section id="homepage" variant="h4" title="Home Page">
      <Paragraph>The Home page provides an overview of recent, ongoing, and future activities.</Paragraph>

      <Section variant="h6" title="My Activity">
        <Paragraph>The &quot;My Activity&quot; section contains an abbreviated list of the activities that you are currently involved with. It will only be present if are currently signed into, or on standby for, an activity.</Paragraph>
      </Section>

      <Section variant="h6" title="Missions">
        <Paragraph>The &quot;Missions&quot; section will contain a list of missions that are currently active, or which concluded within the last 3 days. At present there is no option to view missions that are older than 3 days.</Paragraph>
      </Section>

      <Section variant="h6" title="Events">
        <Paragraph>The &quot;Events&quot; section contains a list of Trainings or other Events that are currently active, or which concluded within the last 3 days. At present there is no option to view Events that are older than 3 days.</Paragraph>
      </Section>
    </Section>
  );
}

function AboutResponding() {
  return (
    <>
      <Section id="respond" variant="h4" title="Responding to a Mission">
        <Paragraph>The primary functionality of Respond is to enable members to sign in and report they are responding to a Mission, Training or other Event. It also provides a way for mission leadership to keep track of the status of responders and see their relevant qualifications. In the future, the timeline events will be used to automate roster entry into the database.</Paragraph>

        <Section variant="h6" title="Signing Into an Activity">
          <Paragraph>By default, the button in each Mission or Event will indicate the expected next action, based on your current status. For example, if you have not signed in yet, or if you are on standby, it will say “Sign In”. Clicking Sign In will sign you into the Mission. Once you are signed in, the button will switch to Sign Out. Clicking it again will sign you out of the mission. Some statuses have a secondary option which appear in a dropdown menu.</Paragraph>
        </Section>

        <Section variant="h6" title="Standby for a Future Activity">
          <Paragraph>Respond is introducing a new feature that enables you to indicate that you are available for a current or future mission, but are not currently responding. Missions that are scheduled to start in the future will default to Stand By; you will not be able to sign into a mission that has not started. To cancel, you can choose Sign Out from the dropdown menu.</Paragraph>
        </Section>
      </Section>
    </>
  );
}

function AboutActivityPage() {
  return (
    <>
      <Section id="activity" variant="h4" title="Activity Detail Page">
        <Paragraph>Clicking on any Mission or Event name will take you to a detail page where you can view the roster of everyone who has signed into the mission, view additional mission information, and access tools to edit a mission, or mark it as complete.</Paragraph>
        <Paragraph>The roster shows each responder’s name, the time of their most recent status change, and a color indicator of their current status; At present, green means they are currently signed in, not green means they are on standby or signed out.</Paragraph>

        <Section variant="h6" title="Edit Activity Details">
          <Paragraph>Clicking the Edit Button will open a form that allows you to edit the mission details.</Paragraph>
        </Section>

        <Section variant="h6" title="Mark Activity as Complete">
          <Paragraph>Clicking Complete will mark the mission as completed. Anyone that was still signed into the mission will be signed out and the buttons to set your status for the mission will be hidden.</Paragraph>
          <Paragraph>Activities that are marked &quot;Complete&quot; can be re-opened by clicking &quot;Reactivate&quot;</Paragraph>
        </Section>

        <Section variant="h6" title="Delete an Activity">
          <Paragraph>Clicking the Red delete icon will delete the mission, which removes it from the Home Page.</Paragraph>
        </Section>
      </Section>
    </>
  );
}

function AboutSartopo() {
  return (
    <>
      <Section id="activity" variant="h4" title="SARTopo Map">
        <Stack direction={{ md: 'row' }}>
          <Box>
            <Paragraph>The Map Id is expected to be a SARTopo Map Id. Only the Id is required. For example if the Map URL is http://sartopo.com/m/ABC12 then the Id is &quot;ABC12&quot;</Paragraph>
            <Paragraph>When a Map Id has been provided it will be shown as a link on the Mission Detail page and as a button with the SARTopo logo on the Activity tiles, on the home page. Clicking on either the link, or the button will open the map in a new browser tab.</Paragraph>
            <Paragraph>If you are on a mobile device, the map may open in the Caltopo App directly. Based on feedback we have received, Android users may need to give Caltopo permission to open links:</Paragraph>
            <Paragraph>
              <ol>
                <li>Open Settings -&gt; Apps -&gt; CalTopo -&gt; Open by default</li>
                <li>Tap on &quot;Add Link&quot;, then select all 3 options.</li>
                <li>The app should now open for CalTopo and SARTopo links.</li>
              </ol>
            </Paragraph>
          </Box>
          <Box sx={{ minWidth: 1 / 3, maxWidth: 300 }}>
            <img src="/about/activity-tile.jpg" alt="Activity Tile" width="100%" />
          </Box>
        </Stack>
      </Section>
    </>
  );
}

function Section({ id, title, variant, mt, children }: { id?: string; title: string; variant: Variant; mt?: number; children: React.ReactNode }) {
  return (
    <>
      {id ? <div id={id} style={{ scrollMarginTop: APP_BAR_OFFSET }} /> : undefined}
      <Typography variant={variant} sx={{ mt: mt ?? 4 }}>
        {title}
      </Typography>
      <Box sx={{ mt: 1 }}>{children}</Box>
    </>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ my: 1 }}>{children}</Typography>;
}
