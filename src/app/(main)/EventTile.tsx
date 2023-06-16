import { ReactNode } from 'react';
import { Card, CardActions, Typography, Grid, Box, Button, IconButton, Link } from "@mui/material";
import { NearMe } from '@mui/icons-material';
import { Activity, ResponderStatus } from '@respond/types/activity';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { getActivityPath, isActive } from '@respond/lib/client/store/activities';
import { StatusChip } from './StatusChip';

export const EventTile = ({ activity, status, children }: { activity: Activity, status?: ResponderStatus, children?: ReactNode }) => {

    return (
      <Card>
        <Box sx={{ p: 1, display: "flex", flexDirection: "row" }}>
          <Box sx={{ flexGrow: 1 }}>
            <Link href={getActivityPath(activity)} color="textPrimary" underline="hover">
              <Typography sx={{ fontWeight: "bold" }} variant="h6">
                {activity.title}
              </Typography>
            </Link>
            <Box>Location: {activity.location.title}</Box>
            <Box>{children}</Box>
          </Box>
          <Box sx={{ alignSelf: "flex-start" }}>
            {status && <StatusChip status={status} />}
          </Box>
        </Box>
        {isActive(activity) && (
          <CardActions sx={{ p: 1 }}>
            <Grid container justifyContent="space-between" alignItems="center">
              <Grid item>
                {activity.mapId && 
                  <IconButton aria-label="Map" href={`https://sartopo.com/m/${activity.mapId}`} target="_blank">
                    <img src="/sartopo-logo.svg" alt="Sartopo Logo" />
                  </IconButton>
                }
                {/* TODO: When we have necessary attribute to implement nav button, do it here.
                <Button aria-label="Navigate" color="info">
                  <NearMe /> Navigate
                </Button>
                */}
              </Grid>
              <Grid item>
                <StatusUpdater activity={activity} />
              </Grid>
            </Grid>
          </CardActions>
        )}
      </Card>
    );
    
};