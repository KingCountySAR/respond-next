import { ReactNode } from 'react';
import { Card, CardActions, Typography, Grid, Box, Button, IconButton, Link } from "@mui/material";
import { NearMe } from '@mui/icons-material';
import { Activity, ResponderStatus } from '@respond/types/activity';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { getActivityPath, isActive } from '@respond/lib/client/store/activities';
import { StatusChip } from './StatusChip';
import Image from 'next/image';

export const EventTile = ({ activity, status, children }: { activity: Activity, status?: ResponderStatus, children?: ReactNode }) => {

    return (
      <Card>
        <Box paddingX={1} paddingTop={1} sx={{ display: "flex", flexDirection: "row" }} alignItems="center">
          <Box sx={{ flexGrow: 1 }}>
            <Link href={getActivityPath(activity)} color="textPrimary" underline="hover">
              <Typography sx={{ fontWeight: "bold" }} variant="h6">
                {activity.title}
              </Typography>
            </Link>
          </Box>
          <Box>
            {status && <StatusChip status={status} />}
          </Box>
        </Box>
        <Box sx={{ px: 1 }}>{children}</Box>
        {isActive(activity) && (
          <CardActions sx={{ p: 1 }}>
            <Grid container justifyContent="space-between" alignItems="center">
              <Grid item>
                {activity.mapId && 
                  <IconButton aria-label="Map" href={`https://sartopo.com/m/${activity.mapId}`} target="_blank">
                    <Image src="/sartopo-logo.svg" alt="Sartopo Logo" width={25} height={25} />
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