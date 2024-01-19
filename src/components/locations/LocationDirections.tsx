import { Place, Route, Straight, TurnLeft, TurnRight } from '@mui/icons-material';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { ReactNode, useState } from 'react';

const tokenRegex = /turn left|turn right|continue|arrive|(?<= )th(?= )|trailhead|parking|(hwy\s|i-)\d+/gi;
const ICON_VIEW_BOX_WIDTH = '24px';

//const testdirections = 'East on I-90 to exit 34;Turn left on 468th Ave SE for 0.4 miles;turn right on Middle Fork Rd;continue for 12.5 miles to the junction with the Taylor River Road;Turn right to continue east for 5 miles to gated TH';

const getIcon = (type: string | undefined) => {
  const token = type?.toLowerCase();

  if (!token) return <Route fontSize={'large'} />;

  switch (token) {
    case 'turn left':
      return <TurnLeft fontSize={'large'} />;
    case 'turn right':
      return <TurnRight fontSize={'large'} />;
    case 'continue':
      return <Straight fontSize={'large'} />;
    case 'arrive':
    case 'trailhead':
    case 'parking':
    case 'th':
      return <Place fontSize={'large'} />;
  }

  if (token.startsWith('hwy')) {
    return <Highway name={token} />;
  }

  if (token.startsWith('i-')) {
    return <Interstate name={token} />;
  }

  return <Route fontSize={'large'} />;
};

export function DrivingDirectionsPanel({ directions }: { directions: string }) {
  const [show, setShow] = useState(false);

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction={'row'} spacing={2} justifyContent={'space-between'} alignItems={'center'}>
          <Typography>Driving Directions</Typography>
          <Button variant="outlined" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'}
          </Button>
        </Stack>
        {show && <DrivingDirections directions={directions} />}
      </Stack>
    </Paper>
  );
}

export function DrivingDirections({ directions }: { directions: string }) {
  return (
    <Stack spacing={1}>
      {directions.split(';').map((step, i) => {
        const icon = getIcon(step.match(tokenRegex)?.[0]);
        return <DirectionsTile key={i} props={{ icon: icon, value: step }} />;
      })}
    </Stack>
  );
}

interface DirectionsTileProps {
  icon: ReactNode;
  value: string;
}

function DirectionsTile({ props }: { props: DirectionsTileProps }) {
  return (
    <Paper>
      <Stack padding={1} direction={'row'} spacing={2} alignItems={'center'}>
        <Box minWidth={ICON_VIEW_BOX_WIDTH} alignContent={'center'}>
          {props.icon}
        </Box>
        <Typography>{props.value}</Typography>
      </Stack>
    </Paper>
  );
}

function Highway({ name }: { name: string }) {
  return (
    <Stack alignItems={'center'}>
      <Typography variant="caption">HWY</Typography>
      <Typography variant="h5">{name.split(' ')[1]}</Typography>
    </Stack>
  );
}

function Interstate({ name }: { name: string }) {
  return (
    <Stack justifyContent={'center'}>
      <Typography variant="h5">{`I${name.split('-')[1]}`}</Typography>
    </Stack>
  );
}
