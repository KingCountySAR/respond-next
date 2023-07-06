import React from 'react';

import { Tab, Tabs, Box, Typography } from "@mui/material";

import { Roster } from '@respond/app/(main)/EventPage';
import { Activity, Participant, ResponderStatus } from '@respond/types/activity';
import { OutputForm, OutputLink, OutputText, OutputTime } from './OutputForm';
import { getActivityStatus } from '@respond/lib/client/store/activities';
import { isActive, reduceDemobilized, reduceSignedOut } from '@respond/types/participant';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const reduceActive = (count: number, participant: Participant) => {
  return count + (isActive(participant?.timeline[0].status) ? 1 : 0);
}

const reduceStandby = (count: number, participant: Participant) => {
  return count + (participant?.timeline[0].status === ResponderStatus.Standby ? 1 : 0);
}

const reduceSignedIn = (count: number, participant: Participant) => {
  return count + (participant?.timeline[0].status === ResponderStatus.SignedIn ? 1 : 0);
}

const reduceCheckedIn = (count: number, participant: Participant) => {
  return count + (isActive(participant?.timeline[0].status) ? 1 : 0);
}

export default function ActivityTabs({activity}:{activity: Activity}) {
  const [value, setValue] = React.useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
          <Tab label="Roster" {...a11yProps(0)} />
          <Tab label="Detail" {...a11yProps(1)} />
        </Tabs>
      </Box>

      <CustomTabPanel value={value} index={0}>
        <Roster participants={activity.participants} orgs={activity.organizations} startTime={activity.startTime} />
      </CustomTabPanel>

      <CustomTabPanel value={value} index={1}>

        <Box sx={{ mb: 2, pt: 2 }}>
          <OutputForm>
            <Box>
              <Typography variant='h6' sx={{ color: 'text.secondary'}}>Overview</Typography>
            </Box>
            <Box>
              <OutputText label="Mission Status" value={getActivityStatus(activity)} />
              <OutputTime label="Start Time" time={activity.startTime}></OutputTime>
              <OutputTime label="Complete Time" time={activity.completeTime}></OutputTime>
              <OutputTime label="End Time" time={activity.endTime}></OutputTime>
            </Box>
          </OutputForm>
        </Box>
        
        <Box sx={{ mb: 2, pt: 2 }}>
          <OutputForm>
            <Box>
              <Typography variant='h6' sx={{ color: 'text.secondary'}}>Responders</Typography>
            </Box>
            <Box>
              <OutputText label="Active Responders" value={Object.values(activity.participants).reduce(reduceActive, 0).toString()}></OutputText>
              <OutputText label="Standby" value={Object.values(activity.participants).reduce(reduceStandby, 0).toString()}></OutputText>
              <OutputText label="Responding" value={Object.values(activity.participants).reduce(reduceSignedIn, 0).toString()}></OutputText>
              <OutputText label="Checked-In" value={Object.values(activity.participants).reduce(reduceCheckedIn, 0).toString()}></OutputText>
              <OutputText label="Demobilized" value={Object.values(activity.participants).reduce(reduceDemobilized, 0).toString()}></OutputText>
              <OutputText label="Signed Out" value={Object.values(activity.participants).reduce(reduceSignedOut, 0).toString()}></OutputText>
            </Box>
          </OutputForm>
        </Box>

        <Box sx={{ pt: 2 }}>
          <OutputForm>
            <Box>
              <Typography variant='h6' sx={{ color: 'text.secondary'}}>Responsible Agency</Typography>
            </Box>
            <Box>
              <OutputText label="Agency" value={activity.organizations[activity.ownerOrgId]?.title} />
            </Box>
          </OutputForm>
        </Box>

      </CustomTabPanel>

    </Box>
  );
}