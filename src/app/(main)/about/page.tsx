'use client';
import { Divider, Grid, Link, Paper, Stack, Typography } from '@mui/material';

import MarkdownFromFile from '@respond/components/MarkdownFromFile';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';

import about from './about.md';

const APP_BAR_OFFSET = 100;

export default function About() {
  return (
    <ToolbarPage maxWidth="lg">
      <Paper elevation={1} sx={{ p: 3 }}>
        <Stack direction={{ md: 'row' }} flex="1 1 auto" spacing={1} divider={<Divider orientation="vertical" flexItem />}>
          <Stack sx={{ mb: 4, minWidth: 175 }}>
            <AboutMenu />
          </Stack>
          <Stack>
            <MarkdownFromFile path={about} anchorOffset={APP_BAR_OFFSET} />
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
        <Link href="https://forms.gle/VhMeCGUUbUHSw4or9">Submit Feedback</Link>
      </Typography>

      <Grid container direction="column" spacing={2} sx={{ my: 1 }}>
        <Grid item>
          <Typography component={Link} href="#home-page">
            Home Page
          </Typography>
        </Grid>
        <Grid item>
          <Typography component={Link} href="#activity-detail-page">
            Activity Page
          </Typography>
        </Grid>
        <Grid item>
          <Typography component={Link} href="#responding-to-a-mission">
            Responding
          </Typography>
        </Grid>
        <Grid item>
          <Typography component={Link} href="#sartopo-map">
            SARTopo Map
          </Typography>
        </Grid>
      </Grid>
    </>
  );
}
