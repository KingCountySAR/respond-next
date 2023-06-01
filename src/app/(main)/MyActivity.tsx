import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { useAppSelector } from '@respond/lib/client/store';
import { buildMyActivitySelector } from '@respond/lib/client/store/activities';
import { ResponderStatus } from '@respond/types/activity';
import Link from 'next/link';

function getStatusText(status: ResponderStatus): string {
  switch (status) {
    case ResponderStatus.SignedIn:
      return "Signed In";
    
    case ResponderStatus.SignedOut:
      return "Signed Out";
    
    case ResponderStatus.Standby:
      return "Standby";
    
    case ResponderStatus.Unavailable:
      return "Not Available";
  }
}

export const MyActivity = () => {
  const myUpdates = useAppSelector(buildMyActivitySelector());

  if (myUpdates.length === 0) {
    return (<></>);
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5">My Activity</Typography>
      <Stack spacing={1}>
        {myUpdates.map(up => (
          <Card key={up.activity.id} sx={{display: 'flex'}}>
            <CardActionArea component={Link} href={`/${up.activity.isMission ? 'mission' : 'event'}/${up.activity.id}`}>
            <CardContent sx={{display: 'flex', alignItems:'center'}}>
              <Box sx={{flex: '1 1 auto'}}>
                <Typography variant="h5" component="div">
                  {up.activity.title} - {getStatusText(up.status.status)}
                </Typography>
              </Box>
            </CardContent>
            </CardActionArea>
            <Box sx={{m:2, display:'flex', flexDirection:'column', justifyContent:'center'}}>
              <StatusUpdater activity={up.activity} current={up.status.status} />
            </Box>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}